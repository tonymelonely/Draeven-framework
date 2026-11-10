/* Draeven Core: tests for project config */

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { readConfig, resolveCommandsFolder } from "./config.js";

test("missing config uses ./commands under the start directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-config-"));
  const resolved = await readConfig(root);

  expect(resolved.configPath).toBeUndefined();
  expect(resolved.commandsFolder).toBe(join(root, "commands"));
});

test("config commands path is resolved next to the config file", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-config-"));
  await writeFile(
    join(root, "draeven.config.js"),
    `export default { commands: "./slash" };\n`
  );

  const resolved = await readConfig(root);

  expect(resolved.configPath).toBe(join(root, "draeven.config.js"));
  expect(resolved.commandsFolder).toBe(join(root, "slash"));
});

test("resolveCommandsFolder accepts absolute paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-abs-"));
  const absolute = resolveCommandsFolder(root);
  expect(absolute).toBe(root);
});

test("config can be imported as a module URL", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-config-"));
  const file = join(root, "draeven.config.mjs");
  await writeFile(file, `export default { commands: "./bot-commands" };\n`);
  await mkdir(join(root, "bot-commands"));

  const resolved = await readConfig(root);
  expect(resolved.commandsFolder).toBe(join(root, "bot-commands"));
  expect(pathToFileURL(resolved.configPath!).href).toContain("draeven.config");
});
