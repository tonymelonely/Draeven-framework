/* Draeven Core: optional error guard — keep the bot alive and log problems */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type GuardVia = "console" | "channel" | "file";
export type GuardOf = "commands" | "events" | "process";

export interface GuardOptions {
  /** Where to write logs. Array to combine, or "all". */
  via: GuardVia | readonly GuardVia[] | "all";
  /** Which error sources to catch. Array to combine, or "all". */
  of: GuardOf | readonly GuardOf[] | "all";
  /** Discord channel id. Required when via includes "channel". */
  channel?: string;
  /** Log file path. Required when via includes "file". */
  file?: string;
  /** Append uptime since Start to each log line. */
  uptime?: boolean;
}

export type GuardKind = GuardOf;

export interface Guard {
  readonly kind: "guard";
  readonly options: Readonly<GuardOptions>;
  /** Whether this guard handles the given source. */
  handles(kind: GuardKind): boolean;
  /** Attach process hooks and channel sender. Call once from Start. */
  attach(runtime: GuardRuntime): void;
  /** Report an error from commands, events, or process. */
  report(kind: GuardKind, error: unknown): void;
  /** Stop process hooks. */
  dispose(): void;
}

export interface GuardRuntime {
  startedAt: number;
  send?: (channelId: string, text: string) => Promise<void>;
}

const guardMark = Symbol.for("draeven.guard");

export function isGuard(value: unknown): value is Guard {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[guardMark] === true &&
    "kind" in value &&
    value.kind === "guard"
  );
}

export function guard(options: GuardOptions): Guard {
  const via = readVia(options.via);
  const of = readOf(options.of);
  const channel = options.channel?.trim();
  const file = options.file?.trim();
  const withUptime = options.uptime === true;

  if (via.includes("channel") && !channel) {
    throw new Error('[Draeven] guard({ via: "channel" }) needs channel.');
  }

  if (via.includes("file") && !file) {
    throw new Error('[Draeven] guard({ via: "file" }) needs file.');
  }

  let runtime: GuardRuntime | undefined;
  let disposed = false;

  const onException = (error: unknown) => {
    report("process", error);
  };
  const onRejection = (reason: unknown) => {
    report("process", reason);
  };

  function report(kind: GuardKind, error: unknown): void {
    if (disposed || !of.has(kind)) {
      return;
    }

    const text = formatReport(kind, error, runtime, withUptime);
    void writeReport(via, text, channel, file, runtime);
  }

  const entry: Guard = {
    kind: "guard",
    options: {
      via: options.via,
      of: options.of,
      ...(channel ? { channel } : {}),
      ...(file ? { file } : {}),
      ...(withUptime ? { uptime: true } : {}),
    },
    handles(kind) {
      return of.has(kind);
    },
    attach(next) {
      if (disposed) {
        return;
      }

      runtime = next;

      if (of.has("process")) {
        process.on("uncaughtException", onException);
        process.on("unhandledRejection", onRejection);
      }

      const text = formatReady(runtime, withUptime);
      void writeReport(via, text, channel, file, runtime);
    },
    report,
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      if (of.has("process")) {
        process.off("uncaughtException", onException);
        process.off("unhandledRejection", onRejection);
      }
    },
  };

  Object.defineProperty(entry, guardMark, {
    value: true,
    enumerable: false,
  });

  return entry;
}

function readVia(value: GuardOptions["via"]): GuardVia[] {
  if (value === "all") {
    return ["console", "channel", "file"];
  }

  const list = typeof value === "string" ? [value] : [...value];

  if (list.length < 1) {
    throw new Error("[Draeven] guard() needs at least one via.");
  }

  for (const item of list) {
    if (item !== "console" && item !== "channel" && item !== "file") {
      throw new Error(`[Draeven] Unknown guard via ${item}.`);
    }
  }

  return [...new Set(list)];
}

function readOf(value: GuardOptions["of"]): Set<GuardOf> {
  if (value === "all") {
    return new Set(["commands", "events", "process"]);
  }

  const list = typeof value === "string" ? [value] : [...value];

  if (list.length < 1) {
    throw new Error("[Draeven] guard() needs at least one of.");
  }

  for (const item of list) {
    if (item !== "commands" && item !== "events" && item !== "process") {
      throw new Error(`[Draeven] Unknown guard of ${item}.`);
    }
  }

  return new Set(list);
}

function formatReady(runtime: GuardRuntime | undefined, withUptime: boolean): string {
  const parts = ["[Draeven] Guard ready."];

  if (withUptime && runtime) {
    parts.push(`uptime ${formatUptime(Date.now() - runtime.startedAt)}`);
  }

  return parts.join(" ");
}

function formatReport(
  kind: GuardKind,
  error: unknown,
  runtime: GuardRuntime | undefined,
  withUptime: boolean
): string {
  const message =
    error instanceof Error
      ? error.stack?.trim() || error.message
      : typeof error === "string"
        ? error
        : String(error);

  const parts = [`[Draeven] ${kind} error.`, message];

  if (withUptime && runtime) {
    parts.push(`uptime ${formatUptime(Date.now() - runtime.startedAt)}`);
  }

  return parts.join("\n");
}

export function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

async function writeReport(
  via: readonly GuardVia[],
  text: string,
  channel: string | undefined,
  file: string | undefined,
  runtime: GuardRuntime | undefined
): Promise<void> {
  if (via.includes("console")) {
    console.error(text);
  }

  if (via.includes("file") && file) {
    try {
      const path = resolve(file);
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${text}\n\n`, "utf8");
    } catch (error) {
      console.error("[Draeven] Guard file log failed.", error);
    }
  }

  if (via.includes("channel") && channel) {
    if (!runtime?.send) {
      console.error("[Draeven] Guard channel log waiting for bot.send.");
      console.error(text);
      return;
    }

    try {
      const clipped = text.length > 1900 ? `${text.slice(0, 1900)}…` : text;
      await runtime.send(channel, clipped);
    } catch (error) {
      console.error("[Draeven] Guard channel log failed.", error);
    }
  }
}
