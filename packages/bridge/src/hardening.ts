/* Bridge network hardening: IP allowlist + optional TLS. */

import { readFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";

export interface HardeningOptions {
  allowIps?: readonly string[];
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }

  const raw = req.socket.remoteAddress ?? "";
  return raw.replace(/^::ffff:/, "");
}

export function ipAllowed(ip: string, allowIps: readonly string[] | undefined): boolean {
  if (!allowIps || allowIps.length < 1) {
    return true;
  }

  if (ip === "127.0.0.1" || ip === "::1") {
    return allowIps.includes("127.0.0.1") || allowIps.includes("::1") || allowIps.includes("localhost");
  }

  return allowIps.includes(ip);
}

export function readAllowIps(raw = process.env.BRIDGE_ALLOW_IPS): string[] {
  return (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function createHardenedServer(
  options: HardeningOptions,
  handler: (req: IncomingMessage, res: import("node:http").ServerResponse) => void
): Promise<HttpServer | HttpsServer> {
  if (options.tlsCertPath && options.tlsKeyPath) {
    const [cert, key] = await Promise.all([
      readFile(options.tlsCertPath),
      readFile(options.tlsKeyPath),
    ]);
    return createHttpsServer({ cert, key }, handler);
  }

  return createHttpServer(handler);
}
