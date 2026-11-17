/* Draeven Core: framework strings */

import { expect, test } from "vitest";
import { frame } from "./strings.js";

test("frame fills placeholders and respects locale", () => {
  expect(frame("cooldown", "en", { name: "ping", seconds: 3 })).toBe(
    "Wait 3s before using /ping again."
  );
  expect(frame("cooldown", "nl", { name: "ping", seconds: 3 })).toContain("3s");
  expect(frame("failed", "nl")).toBe("Het command is mislukt.");
});
