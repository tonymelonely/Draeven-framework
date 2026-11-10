/* Draeven Discord: tests for GatewayConnection */

import { afterEach, expect, test, vi } from "vitest";
import { WebSocketServer } from "ws";
import { GatewayConnection } from "./gateway-connection.js";

let server: WebSocketServer | undefined;

afterEach(async () => {
    vi.unstubAllGlobals();

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

/* Test a real local Gateway connection */
test("connects to the configured Gateway and closes", async () => {
    server = new WebSocketServer({ port: 0 });


    await new Promise<void>((resolve) => {
        server!.once("listening", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("Expected a TCP server address.");
    }

    const connection = new GatewayConnection({
        token: "test-token",
        gatewayUrlOverride: `ws://127.0.0.1:${address.port}`,
        allowInsecureForTests: true,
    });
    /* Send Hello as soon as the WebSocket connects */
    server.on("connection", (socket) => {
        socket.send('{"op":10,"d":{"heartbeat_interval":45000}}');
    });

    /* Connect once and check the received Hello message */
    await expect(connection.connect()).resolves.toEqual({
        heartbeat_interval: 45000,
    });



    const received = new Promise<string>((resolve) => {
        connection.onMessage(resolve);
    });

    for (const socket of server.clients) {
        socket.send('{"op":10,"d":{"heartbeat_interval":45000}}');
    }

    await expect(received).resolves.toContain('"op":10');

    await expect(connection.close()).resolves.toBeUndefined();
});

/* Reject insecure connections without an explicit test setting */
test("rejects insecure Gateway URLs without test permission", async () => {
    const connection = new GatewayConnection({
        token: "test-token",
        gatewayUrlOverride: "ws://127.0.0.1:1234",
    });

    await expect(connection.connect()).rejects.toThrow(
        "Insecure Gateway URLs are only allowed for local tests."
    );
});

/* Do not allow remote insecure connections, including during tests */
test("rejects insecure remote Gateway URLs", async () => {
    const connection = new GatewayConnection({
        token: "test-token",
        gatewayUrlOverride: "ws://example.com",
        allowInsecureForTests: true,
    });

    await expect(connection.connect()).rejects.toThrow(
        "Insecure Gateway URLs are only allowed for local tests."
    );
});

/* Close the connection when Hello does not arrive in time */
test("times out when Gateway Hello is not received", async () => {
  server = new WebSocketServer({ port: 0 });

  await new Promise<void>((resolve) => {
    server!.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  const connection = new GatewayConnection({
    token: "test-token",
    gatewayUrlOverride: `ws://127.0.0.1:${address.port}`,
    allowInsecureForTests: true,
    helloTimeoutMs: 50,
  });

  await expect(connection.connect()).rejects.toThrow(
    "Timed out waiting for Gateway Hello."
  );

});