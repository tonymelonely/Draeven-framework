/* Draeven Discord: tests for the Gateway protocol parser */

import { describe, expect, test } from "vitest";
import {
  parseGatewayPayload,
  buildGatewayUrl,
  parseGatewayHello,
  isHeartbeatAck,
  createHeartbeatPayload,
  createIdentifyPayload,
  createPresencePayload,
  createResumePayload,
} from "./gateway-protocol.js";

describe("parseGatewayPayload", () => {
  test("parses a valid Gateway payload", () => {
    const payload = parseGatewayPayload(
      '{"op":10,"d":{"heartbeat_interval":45000}}'
    );

    expect(payload.op).toBe(10);
    expect(payload.d).toEqual({ heartbeat_interval: 45000 });
  });

  test("rejects invalid JSON", () => {
    expect(() => parseGatewayPayload("{invalid}")).toThrow(
      "Invalid Gateway JSON."
    );
  });

  test("rejects a payload without an opcode", () => {
    expect(() => parseGatewayPayload('{"d":null}')).toThrow(
      "Invalid Gateway payload."
    );
  });

  test("rejects a non-integer opcode", () => {
    expect(() => parseGatewayPayload('{"op":1.5}')).toThrow(
      "Invalid Gateway payload."
    );
  });
});

/* Validate Discord's Hello message */
test("parses a valid Gateway Hello payload", () => {
  expect(
    parseGatewayHello({
      op: 10,
      d: { heartbeat_interval: 45000 },
    })
  ).toEqual({
    heartbeat_interval: 45000,
  });
});

/* Reject an invalid heartbeat interval */
test("rejects an invalid Gateway Hello payload", () => {
  expect(() =>
    parseGatewayHello({
      op: 10,
      d: { heartbeat_interval: 0 },
    })
  ).toThrow("Invalid Gateway Hello payload.");
});

/* Tests for the Gateway URL */
test("adds the required Gateway query parameters", () => {
  const url = new URL(buildGatewayUrl("wss://gateway.discord.gg/"));

  expect(url.protocol).toBe("wss:");
  expect(url.searchParams.get("v")).toBe("10");
  expect(url.searchParams.get("encoding")).toBe("json");
});

test("rejects an insecure Gateway URL", () => {
  expect(() => buildGatewayUrl("ws://gateway.discord.gg/")).toThrow(
    "Gateway URL must use WSS."
  );
});

test("replaces existing Gateway query parameters", () => {
  const url = new URL(
    buildGatewayUrl("wss://gateway.discord.gg/?v=9&encoding=etf")
  );

  expect(url.searchParams.getAll("v")).toEqual(["10"]);
  expect(url.searchParams.getAll("encoding")).toEqual(["json"]);
});

/* Build a heartbeat with the last received sequence */
test("creates a Gateway heartbeat payload", () => {
  expect(createHeartbeatPayload(42)).toEqual({
    op: 1,
    d: 42,
  });
});

/* Use null when no sequence has been received yet */
test("creates a heartbeat with a null sequence", () => {
  expect(createHeartbeatPayload(null)).toEqual({
    op: 1,
    d: null,
  });
});

/* Reject invalid sequence numbers */
test("rejects an invalid heartbeat sequence", () => {
  expect(() => createHeartbeatPayload(-1)).toThrow(
    "Invalid Gateway sequence number."
  );
});

/* Recognize Discord's heartbeat ACK */
test("recognizes a Gateway heartbeat ACK", () => {
  expect(isHeartbeatAck({ op: 11 })).toBe(true);
  expect(isHeartbeatAck({ op: 1, d: null })).toBe(false);
});

test("creates a resume payload", () => {
  expect(createResumePayload("token", "session", 9)).toEqual({
    op: 6,
    d: { token: "token", session_id: "session", seq: 9 },
  });
});

test("identify can carry a presence", () => {
  expect(
    createIdentifyPayload("token", 0, {
      status: "dnd",
      activity: { kind: "watching", text: "slash commands" },
    })
  ).toMatchObject({
    op: 2,
    d: {
      token: "token",
      intents: 0,
      presence: {
        since: null,
        status: "dnd",
        afk: false,
        activities: [{ name: "slash commands", type: 3 }],
      },
    },
  });
});

test("presence update uses opcode 3", () => {
  expect(
    createPresencePayload({
      status: "idle",
      activity: { kind: "playing", text: "Draeven" },
    })
  ).toEqual({
    op: 3,
    d: {
      since: null,
      status: "idle",
      afk: false,
      activities: [{ name: "Draeven", type: 0 }],
    },
  });
});