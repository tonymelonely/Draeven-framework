/* Draeven Discord: tests for Discord ids */

import { expect, test } from "vitest";
import { createdAtFromId } from "./snowflake.js";

test("reads the creation time stored in a Discord id", () => {
  const createdAt = new Date(Date.UTC(2020, 0, 2));
  const id = ((BigInt(createdAt.getTime()) - 1_420_070_400_000n) << 22n).toString();

  expect(createdAtFromId(id).toISOString()).toBe(createdAt.toISOString());
});

test("rejects an id that is not a snowflake", () => {
  expect(() => createdAtFromId("tony")).toThrow("Invalid Discord id.");
});
