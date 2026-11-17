import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import type { Bot, BotSyncState } from "@draeven/core";
import { afterAll, expect, test } from "vitest";
import { startDashboard } from "./server.js";

function mockBot(): Bot {
  const sync: BotSyncState = {
    watch: false,
    commandCount: 0,
  };

  return {
    get commands() {
      return [];
    },
    async stop() {},
    setPresence() {},
    syncState() {
      return { ...sync };
    },
    onSync() {
      return () => undefined;
    },
    async send() {
      throw new Error("not used");
    },
    onEvent() {
      return () => undefined;
    },
    onMemberJoin() {
      return () => undefined;
    },
    onMemberLeave() {
      return () => undefined;
    },
    onMessage() {
      return () => undefined;
    },
  };
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("no port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

test("bridge rejects /api/status without secret and serves /api/health", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-bridge-"));
  roots.push(root);
  const port = await freePort();
  const secret = "test-bridge-secret";

  const handle = await startDashboard({
    bot: mockBot(),
    root,
    botToken: "invalid-token-for-tests",
    kind: "bridge",
    bridgeSecret: secret,
    host: "127.0.0.1",
    port,
  });

  try {
    const health = await fetch(`${handle.url}api/health`);
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { ok?: boolean; mode?: string };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.mode).toBe("bridge");

    const denied = await fetch(`${handle.url}api/status`);
    expect(denied.status).toBe(401);

    const ok = await fetch(`${handle.url}api/status`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(ok.status).toBe(200);
  } finally {
    await handle.stop();
  }
});
