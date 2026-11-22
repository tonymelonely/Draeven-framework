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
  expect(typeof events.handlers.memberJoin).toBe("function");
  expect(typeof events.handlers.message).toBe("function");
  expect(events.handlers.memberLeave).toBeUndefined();
  expect(events.uses).toEqual([]);
});

test("loadEvents collects use() exports", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-use-"));

  await writeFile(
    join(root, "hangman.js"),
    `
import { pathToFileURL } from "node:url";
const mark = Symbol.for("draeven.use");
export const hangman = {
  [mark]: true,
  ids: "hangman_*",
  kind: "press",
  run: async (ctx) => ctx.reply(ctx.id),
};
`
  );

  const events = await loadEvents(root);
  expect(events.uses).toHaveLength(1);
  expect(events.uses[0]?.ids).toBe("hangman_*");
});
