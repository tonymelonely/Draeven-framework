/* Draeven Core: load every command export from a folder */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertCommands, isCommand, type Command } from "./command.js";
import { isMenu, type MenuCommand } from "./menus.js";

export type LoadableCommand = Command | MenuCommand;

/* Import each .js module in the folder and collect command() / menu exports. */
export async function loadCommands(folder: string | URL): Promise<LoadableCommand[]> {
  const dir = typeof folder === "string" ? folder : fileURLToPath(folder);
  let names: string[];

  try {
    names = await readdir(dir);
  } catch (error) {
    throw new Error(
      `[Draeven] Cannot read commands folder ${dir}. ${error instanceof Error ? error.message : ""}`.trim()
    );
  }

  const files = names
    .filter((name) => name.endsWith(".js"))
    .filter((name) => !name.endsWith(".test.js"))
    .filter((name) => !name.endsWith("old.js"))
    .sort((left, right) => left.localeCompare(right));

  const loaded: LoadableCommand[] = [];

  for (const file of files) {
    const href = pathToFileURL(join(dir, file)).href;
    const module = await import(href);

    for (const value of Object.values(module)) {
      if (isCommand(value) || isMenu(value)) {
        loaded.push(value);
      }
    }
  }

  loaded.sort((left, right) => left.name.localeCompare(right.name));
  assertLoadables(loaded);
  return loaded;
}

function assertLoadables(commands: readonly LoadableCommand[]): void {
  const slash = commands.filter(isCommand);
  assertCommands(slash);

  const seen = new Map<string, string>();

  for (const entry of commands) {
    const key =
      entry.kind === "slash"
        ? `slash:${entry.name}`
        : entry.kind === "user-menu"
          ? `user:${entry.name}`
          : `message:${entry.name}`;

    if (seen.has(key)) {
      throw new Error(`[Draeven] Command ${entry.name} is defined more than once.`);
    }

    seen.set(key, entry.name);
  }
}
