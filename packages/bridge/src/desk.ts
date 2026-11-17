/* Remote desk UI: Discord OAuth locally, API proxied to a bot bridge. */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  beginOAuth,
  clearSessionCookie,
  createSession,
  currentUser,
  destroySession,
  finishOAuth,
  readAuthConfig,
  setSessionCookie,
} from "./auth.js";
import { closeHttpServer } from "./close-server.js";
import {
  clientIp,
  createHardenedServer,
  ipAllowed,
  readAllowIps,
} from "./hardening.js";
import { bridgePublicDir } from "./paths.js";

export interface DeskOptions {
  root: string;
  bridgeUrl: string;
  bridgeSecret: string;
  host?: string;
  port?: number;
  allowIps?: readonly string[];
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

export interface DeskHandle {
  readonly url: string;
  stop(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function startDesk(options: DeskOptions): Promise<DeskHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.DASHBOARD_PORT ?? "3847");
  const publicDir = bridgePublicDir();
  const authConfig = readAuthConfig();
  const bridgeUrl = options.bridgeUrl.replace(/\/$/, "");
  const bridgeSecret = options.bridgeSecret;
  const allowIps = options.allowIps ?? readAllowIps();
  const scheme = options.tlsCertPath && options.tlsKeyPath ? "https" : "http";

  if (!authConfig) {
    throw new Error(
      "[Draeven] Desk mode needs DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DASHBOARD_OWNER_IDS."
    );
  }

  const auth = authConfig;
  const openStreams = new Set<ServerResponse>();
  const abortControllers = new Set<AbortController>();

  const server = await createHardenedServer(
    {
      allowIps,
      ...(options.tlsCertPath ? { tlsCertPath: options.tlsCertPath } : {}),
      ...(options.tlsKeyPath ? { tlsKeyPath: options.tlsKeyPath } : {}),
    },
    (req, res) => {
      void handleRequest(req, res).catch((error) => {
        console.error("[Draeven Desk] Request failed.", error);
        if (!res.headersSent) {
          json(res, 500, { error: "Internal error." });
        }
      });
    }
  );

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!ipAllowed(clientIp(req), allowIps)) {
      json(res, 403, { error: "IP not allowed." });
      return;
    }

    const url = new URL(req.url ?? "/", `${scheme}://${host}:${port}`);
    const path = url.pathname;

    if (path === "/auth/login" && req.method === "GET") {
      const { url: oauthUrl } = beginOAuth(auth);
      res.writeHead(302, { Location: oauthUrl });
      res.end();
      return;
    }

    if (path === "/auth/callback" && req.method === "GET") {
      try {
        const user = await finishOAuth(
          auth,
          url.searchParams.get("code") ?? "",
          url.searchParams.get("state") ?? ""
        );
        setSessionCookie(res, createSession(auth, user));
        res.writeHead(302, { Location: "/" });
        res.end();
      } catch (error) {
        res.writeHead(302, {
          Location: `/?authError=${encodeURIComponent(
            error instanceof Error ? error.message : "Login failed"
          )}`,
        });
        res.end();
      }
      return;
    }

    if (path === "/auth/logout" && req.method === "POST") {
      destroySession(req, auth);
      clearSessionCookie(res);
      json(res, 200, { ok: true });
      return;
    }

    if (path === "/api/session" && req.method === "GET") {
      json(res, 200, {
        oauthConfigured: true,
        user: currentUser(req, auth) ?? null,
        mode: "desk",
        bridgeUrl,
      });
      return;
    }

    if (path.startsWith("/api/")) {
      const user = currentUser(req, auth);
      if (!user) {
        json(res, 401, { error: "Sign in with Discord first." });
        return;
      }

      await proxyToBridge(req, res, path + url.search, user);
      return;
    }

    if (req.method === "GET") {
      const filePath =
        path === "/" || !extname(path)
          ? join(publicDir, "index.html")
          : join(publicDir, path.replace(/^\/+/, ""));

      if (!filePath.startsWith(publicDir)) {
        json(res, 403, { error: "Forbidden." });
        return;
      }

      try {
        const bytes = await readFile(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(bytes);
      } catch {
        const fallback = await readFile(join(publicDir, "index.html"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(fallback);
      }
      return;
    }

    json(res, 405, { error: "Method not allowed." });
  }

  async function proxyToBridge(
    req: IncomingMessage,
    res: ServerResponse,
    pathWithQuery: string,
    user: { id: string; name: string }
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const controller = new AbortController();
    abortControllers.add(controller);
    req.on("close", () => {
      controller.abort();
      abortControllers.delete(controller);
    });

    const upstream = await fetch(`${bridgeUrl}${pathWithQuery}`, {
      method: req.method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bridgeSecret}`,
        "Content-Type": req.headers["content-type"] ?? "application/json",
        "X-Draeven-Actor": user.name,
        "X-Draeven-Actor-Id": user.id,
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : chunks.length > 0
            ? Buffer.concat(chunks)
            : undefined,
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";

    if (contentType.includes("text/event-stream")) {
      res.writeHead(upstream.status, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      openStreams.add(res);

      if (!upstream.body) {
        openStreams.delete(res);
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const cleanup = () => {
        openStreams.delete(res);
        void reader.cancel().catch(() => undefined);
      };
      req.on("close", cleanup);
      res.on("close", cleanup);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (!res.writableEnded) {
            res.write(Buffer.from(value));
          }
        }
      } finally {
        cleanup();
        if (!res.writableEnded) {
          res.end();
        }
      }
      return;
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    res.end(bytes);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  return {
    url: `${scheme}://${host}:${port}/`,
    async stop() {
      for (const controller of abortControllers) {
        controller.abort();
      }
      abortControllers.clear();
      await closeHttpServer(server, openStreams);
      openStreams.clear();
    },
  };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
