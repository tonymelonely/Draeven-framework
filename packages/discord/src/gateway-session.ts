/* Draeven Discord: identify, resume, heartbeat, and ready */

import type { GatewayConnection } from "./gateway-connection.js";
import { readDiscordProfile, type DiscordProfile } from "./discord-user.js";
import {
  createHeartbeatPayload,
  createIdentifyPayload,
  createPresencePayload,
  createResumePayload,
  isHeartbeatAck,
  parseGatewayPayload,
  type GatewayPayload,
  type Presence,
} from "./gateway-protocol.js";

export interface ReadyGateway {
  applicationId: string;
  user: DiscordProfile;
}

export interface SessionResume {
  sessionId: string;
  sequence: number | null;
  resumeUrl?: string;
}

const READY_TIMEOUT_MS = 15_000;
const MAX_RECOVER_ATTEMPTS = 8;

export class GatewaySession {
  private sequence: number | null = null;
  private sessionId: string | undefined;
  private resumeUrl: string | undefined;
  private applicationId: string | undefined;
  private user: DiscordProfile | undefined;
  private acked = true;
  private closed = false;
  private stopping = false;
  private failing = false;
  private recovering = false;
  private readySettled = false;
  private heartbeat: ReturnType<typeof setTimeout> | undefined;
  private heartbeatInterval = 0;
  private resolveReady: ((ready: ReadyGateway) => void) | undefined;
  private rejectReady: ((error: Error) => void) | undefined;
  private readonly dispatchHandlers = new Set<(payload: GatewayPayload) => void>();

  constructor(
    private readonly connection: GatewayConnection,
    private readonly token: string,
    private readonly intents: number,
    private presence: Presence | undefined = undefined
  ) {}

  setPresence(presence: Presence): void {
    this.presence = presence;

    if (this.closed || this.stopping) {
      return;
    }

    this.connection.send(JSON.stringify(createPresencePayload(presence)));
  }

  onDispatch(handler: (payload: GatewayPayload) => void): () => void {
    this.dispatchHandlers.add(handler);
    return () => this.dispatchHandlers.delete(handler);
  }

  resumeState(): SessionResume | undefined {
    if (!this.sessionId) {
      return undefined;
    }

    return {
      sessionId: this.sessionId,
      sequence: this.sequence,
      ...(this.resumeUrl ? { resumeUrl: this.resumeUrl } : {}),
    };
  }

  /* Connect, identify, and resolve when Discord sends Ready. */
  async run(): Promise<ReadyGateway> {
    this.connection.onMessage((message) => {
      this.receive(message);
    });
    this.connection.onError((error) => {
      this.fail(error);
    });

    try {
      const hello = await this.connection.connect();
      const ready = new Promise<ReadyGateway>((resolve, reject) => {
        this.resolveReady = resolve;
        this.rejectReady = reject;
      });

      this.heartbeatInterval = hello.heartbeat_interval;
      this.connection.send(
        JSON.stringify(
          createIdentifyPayload(this.token, this.intents, this.presence)
        )
      );
      this.scheduleHeartbeat(hello.heartbeat_interval);

      return await withTimeout(ready, READY_TIMEOUT_MS);
    } catch (error) {
      if (!this.readySettled) {
        this.readySettled = true;
        this.rejectReady?.(
          error instanceof Error
            ? error
            : new Error("[Draeven Discord] Gateway failed.")
        );
      }

      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    this.stopping = true;
    await this.shutdownSocket();
    this.closed = true;
  }

  private async shutdownSocket(): Promise<void> {
    if (this.heartbeat !== undefined) {
      clearTimeout(this.heartbeat);
      this.heartbeat = undefined;
    }

    await this.connection.close();
  }

  private scheduleHeartbeat(interval: number): void {
    if (this.heartbeat !== undefined) {
      clearTimeout(this.heartbeat);
    }

    const first = Math.floor(Math.random() * interval);

    const tick = () => {
      if (this.closed || this.stopping) {
        return;
      }

      this.beat();

      if (this.closed || this.stopping) {
        return;
      }

      this.heartbeat = setTimeout(tick, interval);
    };

    this.heartbeat = setTimeout(tick, first);
  }

  private beat(): void {
    if (this.closed || this.stopping) {
      return;
    }

    if (!this.acked) {
      this.fail(
        new Error("[Draeven Discord] Gateway heartbeat was not acknowledged.")
      );
      return;
    }

    this.acked = false;
    try {
      this.connection.send(
        JSON.stringify(createHeartbeatPayload(this.sequence))
      );
    } catch (error) {
      this.fail(
        error instanceof Error
          ? error
          : new Error("[Draeven Discord] Gateway send failed.")
      );
    }
  }

  private receive(message: string): void {
    let payload: GatewayPayload;

    try {
      payload = parseGatewayPayload(message);
    } catch (error) {
      this.fail(
        error instanceof Error
          ? error
          : new Error("[Draeven Discord] Invalid Gateway payload.")
      );
      return;
    }

    if (typeof payload.s === "number") {
      this.sequence = payload.s;
    }

    if (payload.op === 1) {
      this.acked = true;
      this.beat();
      return;
    }

    if (isHeartbeatAck(payload)) {
      this.acked = true;
      return;
    }

    if (payload.op === 7) {
      void this.recover(true);
      return;
    }

    if (payload.op === 9) {
      const canResume = payload.d === true;
      if (!canResume) {
        this.sessionId = undefined;
        this.resumeUrl = undefined;
        this.sequence = null;
      }
      void this.recover(canResume);
      return;
    }

    if (payload.op !== 0) {
      return;
    }

    for (const handler of this.dispatchHandlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error("[Draeven Discord] Dispatch handler failed.", error);
      }
    }

    if (payload.t === "RESUMED") {
      this.recovering = false;
      this.failing = false;
      return;
    }

    if (payload.t !== "READY") {
      return;
    }

    const ready = readReady(payload);

    if (!ready) {
      this.fail(
        new Error("[Draeven Discord] Discord returned an invalid Ready payload.")
      );
      return;
    }

    this.sessionId = ready.sessionId;
    this.resumeUrl = ready.resumeUrl;
    this.applicationId = ready.applicationId;
    this.user = ready.user;
    this.recovering = false;
    this.failing = false;

    if (!this.readySettled) {
      this.readySettled = true;
      this.resolveReady?.({
        applicationId: ready.applicationId,
        user: ready.user,
      });
    }
  }

  private fail(error: Error): void {
    if (this.stopping || this.failing) {
      return;
    }

    this.failing = true;

    if (!this.readySettled) {
      this.readySettled = true;
      this.rejectReady?.(error);
      void this.close();
      return;
    }

    console.error("[Draeven Discord] Gateway connection lost.", error);
    void this.recover(Boolean(this.sessionId));
  }

  private async recover(tryResume: boolean): Promise<void> {
    if (this.stopping || this.recovering) {
      return;
    }

    this.recovering = true;
    this.failing = false;

    for (let attempt = 0; attempt < MAX_RECOVER_ATTEMPTS; attempt += 1) {
      if (this.stopping) {
        return;
      }

      try {
        await this.shutdownSocket();
        this.closed = false;
        this.acked = true;

        const hello = await this.connection.connect(
          tryResume && this.resumeUrl ? this.resumeUrl : undefined
        );
        this.heartbeatInterval = hello.heartbeat_interval;

        if (tryResume && this.sessionId) {
          this.connection.send(
            JSON.stringify(
              createResumePayload(this.token, this.sessionId, this.sequence)
            )
          );
        } else {
          this.sessionId = undefined;
          this.connection.send(
            JSON.stringify(
              createIdentifyPayload(this.token, this.intents, this.presence)
            )
          );
        }

        this.scheduleHeartbeat(hello.heartbeat_interval);
        this.recovering = false;
        this.failing = false;
        return;
      } catch (error) {
        const wait = Math.min(1000 * 2 ** attempt, 30_000);
        console.error(
          `[Draeven Discord] Gateway recover failed (attempt ${attempt + 1}). Retrying in ${wait}ms.`,
          error
        );
        await sleep(wait);
        tryResume = false;
      }
    }

    this.recovering = false;
    console.error("[Draeven Discord] Gateway recover gave up.");
    this.stopping = true;
    this.closed = true;
  }
}

function readReady(payload: GatewayPayload):
  | (ReadyGateway & { sessionId: string; resumeUrl?: string })
  | undefined {
  const data = payload.d;

  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  if (!("user" in data) || !("application" in data) || !("session_id" in data)) {
    return undefined;
  }

  const user = readDiscordProfile(data.user);
  const application = data.application;
  const sessionId =
    typeof data.session_id === "string" && data.session_id
      ? data.session_id
      : undefined;
  const resumeUrl =
    "resume_gateway_url" in data &&
    typeof data.resume_gateway_url === "string" &&
    data.resume_gateway_url
      ? data.resume_gateway_url
      : undefined;

  if (
    !user ||
    !sessionId ||
    typeof application !== "object" ||
    application === null ||
    !("id" in application) ||
    typeof application.id !== "string" ||
    !application.id
  ) {
    return undefined;
  }

  return {
    applicationId: application.id,
    user,
    sessionId,
    ...(resumeUrl ? { resumeUrl } : {}),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("[Draeven Discord] Timed out waiting for Ready."));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
