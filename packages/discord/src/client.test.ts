/* Draeven Discord: tests for the client lifecycle */

import { afterEach, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { DiscordClient } from "./index.js";

let server: WebSocketServer | undefined;

afterEach(async () => {
  if (!server) {
    return;
  }

  const current = server;
  server = undefined;

  for (const socket of current.clients) {
    socket.terminate();
  }

  await new Promise<void>((resolve, reject) => {
    current.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

test("starts in the stopped state", () => {
  const client = new DiscordClient({ token: "test-token" });

  expect(client.getStatus()).toBe("stopped");
});

test("rejects an empty token", async () => {
  const client = new DiscordClient({ token: "   " });

  await expect(client.start()).rejects.toThrow("A token is required.");
  expect(client.getStatus()).toBe("failed");
});

test("becomes ready and receives a slash command", async () => {
  server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    server!.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  server.on("connection", (socket) => {
    socket.send(JSON.stringify({ op: 10, d: { heartbeat_interval: 1000 } }));

    socket.on("message", (data) => {
      const payload = JSON.parse(data.toString()) as { op?: number };

      if (payload.op === 1) {
        socket.send(JSON.stringify({ op: 11 }));
      }

      if (payload.op === 2) {
        socket.send(
          JSON.stringify({
            op: 0,
            t: "READY",
            s: 1,
            d: {
              session_id: "session-1",
              resume_gateway_url: "wss://gateway.discord.gg",
              user: {
                id: "100",
                username: "draeven",
                global_name: "Draeven",
                bot: true,
              },
              application: { id: "100" },
            },
          })
        );
      }
    });
  });

  const client = new DiscordClient({
    token: "test-token",
    gatewayUrlOverride: `ws://127.0.0.1:${address.port}`,
    allowInsecureForTests: true,
  });

  await client.start();

  expect(client.getStatus()).toBe("ready");
  expect(client.readyUser()).toEqual({
    id: "100",
    name: "Draeven",
    bot: true,
    applicationId: "100",
  });

  const received = new Promise<string>((resolve) => {
    client.onCommand((command) => resolve(command.name));
  });

  for (const socket of server.clients) {
    socket.send(
      JSON.stringify({
        op: 0,
        t: "INTERACTION_CREATE",
        s: 2,
        d: {
          type: 2,
          id: "interaction",
          token: "token",
          data: { name: "userinfo" },
          user: { id: "5", username: "tony" },
        },
      })
    );
  }

  await expect(received).resolves.toBe("userinfo");

  await client.stop();

  expect(client.getStatus()).toBe("stopped");
});
