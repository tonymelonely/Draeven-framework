/* Draeven Core: project config (commands folder and friends) */

import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface DraevenConfig {
  /** Folder with command modules. Default: "./commands" */
  commands?: string;
}

export interface ResolvedConfig {
  /** Absolute folder that holds compiled command modules. */
  commandsFolder: string;
  /** Absolute path of the config file, when one was found. */
  configPath?: string;
}

const CONFIG_NAMES = ["draeven.config.js", "draeven.config.mjs"] as const;
const DEFAULT_COMMANDS = "./commands";

/* Read draeven.config from cwd (and parents). Missing file uses the default folder. */
export async function readConfig(startDir: string = process.cwd()): Promise<ResolvedConfig> {
  const found = findConfigFile(startDir);

  if (!found) {
    return {
      commandsFolder: resolve(startDir, DEFAULT_COMMANDS),
    };
  }

  const loaded = await import(pathToFileURL(found).href);
  const raw = (loaded.default ?? loaded) as DraevenConfig;
  const relative =
    typeof raw?.commands === "string" && raw.commands.trim()
      ? raw.commands.trim()
      : DEFAULT_COMMANDS;

  return {
    commandsFolder: resolveCommandsFolder(relative, dirname(found)),
    configPath: found,
  };
}

/* Resolve a commands folder path relative to a base directory. */
export function resolveCommandsFolder(folder: string, baseDir: string = process.cwd()): string {
  const trimmed = folder.trim();

  if (!trimmed) {
    throw new Error("[Draeven] A commands folder path cannot be empty.");
  }

  return isAbsolute(trimmed) ? trimmed : resolve(baseDir, trimmed);
}

function findConfigFile(startDir: string): string | undefined {
  let dir = resolve(startDir);

  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);

      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(dir);

    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}
