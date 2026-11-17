import { expect, test } from "vitest";
import { readBridgeSecret, readBridgeUrl, readDashboardMode } from "./mode.js";

test("readDashboardMode defaults to embedded", () => {
  expect(readDashboardMode(undefined)).toBe("embedded");
  expect(readDashboardMode("")).toBe("embedded");
  expect(readDashboardMode("EMBEDDED")).toBe("embedded");
});

test("readDashboardMode accepts off aliases", () => {
  expect(readDashboardMode("off")).toBe("off");
  expect(readDashboardMode("0")).toBe("off");
  expect(readDashboardMode("false")).toBe("off");
  expect(readDashboardMode("no")).toBe("off");
});

test("readDashboardMode accepts bridge and desk aliases", () => {
  expect(readDashboardMode("bridge")).toBe("bridge");
  expect(readDashboardMode("api")).toBe("bridge");
  expect(readDashboardMode("desk")).toBe("desk");
  expect(readDashboardMode("ui")).toBe("desk");
  expect(readDashboardMode("remote")).toBe("desk");
});

test("readBridgeSecret requires 12+ characters", () => {
  const previous = process.env.BRIDGE_SECRET;
  const previousToken = process.env.DASHBOARD_TOKEN;
  delete process.env.BRIDGE_SECRET;
  delete process.env.DASHBOARD_TOKEN;

  expect(() => readBridgeSecret()).toThrow(/BRIDGE_SECRET/);

  process.env.BRIDGE_SECRET = "short";
  expect(() => readBridgeSecret()).toThrow(/BRIDGE_SECRET/);

  process.env.BRIDGE_SECRET = "long-enough-secret";
  expect(readBridgeSecret()).toBe("long-enough-secret");

  if (previous === undefined) delete process.env.BRIDGE_SECRET;
  else process.env.BRIDGE_SECRET = previous;
  if (previousToken === undefined) delete process.env.DASHBOARD_TOKEN;
  else process.env.DASHBOARD_TOKEN = previousToken;
});

test("readBridgeUrl requires BRIDGE_URL", () => {
  const previous = process.env.BRIDGE_URL;
  delete process.env.BRIDGE_URL;
  expect(() => readBridgeUrl()).toThrow(/BRIDGE_URL/);

  process.env.BRIDGE_URL = "http://127.0.0.1:3848/";
  expect(readBridgeUrl()).toBe("http://127.0.0.1:3848");

  if (previous === undefined) delete process.env.BRIDGE_URL;
  else process.env.BRIDGE_URL = previous;
});
