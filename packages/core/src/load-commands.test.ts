/* Draeven Core: tests for loading commands from a folder */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadCommands } from "./load-commands.js";

test("loadCommands collects command exports and skips old files", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-cmds-"));

  await writeFile(
    join(root, "ping.js"),
    `
      const mark = Symbol.for("draeven.command");
      const ping = { kind: "slash", name: "ping", description: "Ping", options: {}, subs: {}, run() {} };
      Object.defineProperty(ping, mark, { value: true });
      export { ping };
    `
  );
  await writeFile(
    join(root, "extra.js"),
    `
      const mark = Symbol.for("draeven.command");
      const hello = { kind: "slash", name: "hello", description: "Hello", options: {}, subs: {}, run() {} };
      Object.defineProperty(hello, mark, { value: true });
      export const notACommand = { name: "nope" };
      export { hello };
    `
  );
  await writeFile(
    join(root, "transcriptold.js"),
    `
      const mark = Symbol.for("draeven.command");
      const transcript = { kind: "slash", name: "transcript-old", description: "Old", options: {}, subs: {}, run() {} };
      Object.defineProperty(transcript, mark, { value: true });
      export { transcript };
    `
  );

  const loaded = await loadCommands(root);

  expect(loaded.map((entry) => entry.name)).toEqual(["hello", "ping"]);
});

test("loadCommands can bust the module cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-cmds-"));
  const file = join(root, "ping.js");

  await writeFile(
    file,
    `
      const mark = Symbol.for("draeven.command");
      const ping = { kind: "slash", name: "ping", description: "One", options: {}, subs: {}, run() {} };
      Object.defineProperty(ping, mark, { value: true });
      export { ping };
    `
  );

  const first = await loadCommands(root);
  expect(first[0]?.kind === "slash" ? first[0].description : "").toBe("One");

  await writeFile(
    file,
    `
      const mark = Symbol.for("draeven.command");
      const ping = { kind: "slash", name: "ping", description: "Two", options: {}, subs: {}, run() {} };
      Object.defineProperty(ping, mark, { value: true });
      export { ping };
    `
  );

  const second = await loadCommands(root, { bust: true });
  expect(second[0]?.kind === "slash" ? second[0].description : "").toBe("Two");
});
