/* Draeven Core: tests for loadEvents */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadEvents } from "./load-events.js";

test("loadEvents merges named handlers from a folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-events-"));

  await writeFile(
    join(root, "join.js"),
    `export function memberJoin(member) { return member.name; }`
  );
  await writeFile(
    join(root, "chat.js"),
    `export function message(entry) { return entry.id; }`
  );

  const events = await loadEvents(root);
  expect(typeof events.memberJoin).toBe("function");
  expect(typeof events.message).toBe("function");
  expect(events.memberLeave).toBeUndefined();
});
