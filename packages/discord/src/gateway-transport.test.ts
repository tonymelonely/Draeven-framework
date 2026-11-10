/* Draeven Discord: tests for GatewayTransport */

import { afterEach, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { GatewayTransport } from "./gateway-transport.js";
import { parseGatewayPayload } from "./gateway-protocol.js";

let server: WebSocketServer | undefined;

/* Test receiving and parsing a Gateway payload */
test("receives and parses a Gateway payload", async () => {
  server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    server!.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  const transport = new GatewayTransport({
    url: `ws://127.0.0.1:${address.port}`,
  });

  await transport.connect();

  const received = new Promise<string>((resolve) => {
    transport.onMessage(resolve);
  });

  for (const socket of server.clients) {
    socket.send('{"op":10,"d":{"heartbeat_interval":45000}}');
  }

  const rawMessage = await received;
  const payload = parseGatewayPayload(rawMessage);

  expect(payload.op).toBe(10);
  expect(payload.d).toEqual({ heartbeat_interval: 45000 });

  await transport.close();
});

afterEach(async () => {
  if (!server) return;

  const currentServer = server;
  server = undefined;

  for (const socket of currentServer.clients) {
    socket.terminate();
  }

  await new Promise<void>((resolve, reject) => {
    currentServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

test("connects and closes a WebSocket connection", async () => {
  server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    server!.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  const transport = new GatewayTransport({
    url: `ws://127.0.0.1:${address.port}`,
  });

  await transport.connect();

  await expect(transport.close()).resolves.toBeUndefined();
});

test("rejects sending when disconnected", () => {
  const transport = new GatewayTransport({
    url: "ws://127.0.0.1:1",
  });

  expect(() => transport.send("test")).toThrow(
    "Transport is not connected."
  );
});

/* Test receiving a WebSocket message */
test("receives an incoming text message", async () => {
  server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    server!.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  const transport = new GatewayTransport({
    url: `ws://127.0.0.1:${address.port}`,
  });

  await transport.connect();

  const received = new Promise<string>((resolve) => {
    transport.onMessage(resolve);
  });

  for (const socket of server.clients) {
    socket.send('{"op":10,"d":{"heartbeat_interval":45000}}');
  }

  await expect(received).resolves.toBe(
    '{"op":10,"d":{"heartbeat_interval":45000}}'
  );

  await transport.close();
});

/* Support handlers registered before connecting */
test("allows registering a message handler before connecting", async () => {
  const localServer = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    localServer.once("listening", resolve);
  });

  const address = localServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  const transport = new GatewayTransport({
    url: `ws://127.0.0.1:${address.port}`,
  });

  const received = new Promise<string>((resolve) => {
    transport.onMessage(resolve);
  });

  try {
    await transport.connect();

    for (const socket of localServer.clients) {
      socket.send('{"op":10,"d":{"heartbeat_interval":45000}}');
    }

    await expect(received).resolves.toContain('"op":10');
  } finally {
    await transport.close();

    for (const socket of localServer.clients) {
      socket.terminate();
    }

    await new Promise<void>((resolve, reject) => {
      localServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});