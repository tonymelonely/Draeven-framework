import { expect, test } from "vitest";
import { ipAllowed, readAllowIps } from "./hardening.js";

test("readAllowIps splits and trims", () => {
  expect(readAllowIps("")).toEqual([]);
  expect(readAllowIps("127.0.0.1, ::1 , localhost")).toEqual([
    "127.0.0.1",
    "::1",
    "localhost",
  ]);
});

test("ipAllowed allows all when list is empty", () => {
  expect(ipAllowed("203.0.113.9", undefined)).toBe(true);
  expect(ipAllowed("203.0.113.9", [])).toBe(true);
});

test("ipAllowed matches exact IPs and localhost aliases", () => {
  expect(ipAllowed("203.0.113.9", ["203.0.113.9"])).toBe(true);
  expect(ipAllowed("203.0.113.10", ["203.0.113.9"])).toBe(false);
  expect(ipAllowed("127.0.0.1", ["127.0.0.1"])).toBe(true);
  expect(ipAllowed("::1", ["127.0.0.1"])).toBe(true);
  expect(ipAllowed("127.0.0.1", ["localhost"])).toBe(true);
});
