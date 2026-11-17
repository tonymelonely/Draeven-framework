/* Draeven Core: load gateway event handlers from a folder */

import { copyFile, readdir, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  gatewayEventNames,
  type GatewayEventName,
  type GatewayEvents,
} from "@draeven/discord";

export type BotEvents = {
  [K in GatewayEventName]?: (value: GatewayEvents[K]) => void | Promise<void>;
};

const RELOAD_PREFIX = ".draeven-reload-";

/* Import each .js module and merge known event exports. */
export async function loadEvents(
  folder: string | URL,
  options?: { bust?: boolean }
): Promise<BotEvents> {
  const dir = typeof folder === "string" ? folder : fileURLToPath(folder);
  let names: string[];

  try {
    names = await readdir(dir);
  } catch (error) {
    throw new Error(
      `[Draeven] Cannot read events folder ${dir}. ${error instanceof Error ? error.message : ""}`.trim()
    );
  }

  const files = names
    .filter((name) => name.endsWith(".js"))
    .filter((name) => !name.endsWith(".test.js"))
    .filter((name) => !name.endsWith("old.js"))
    .filter((name) => !name.startsWith(RELOAD_PREFIX))
    .filter((name) => !name.startsWith("."))
    .sort((left, right) => left.localeCompare(right));

  const events: BotEvents = {};

  for (const file of files) {
    const module = await importModule(join(dir, file), options?.bust === true);

    for (const key of gatewayEventNames) {
      assignHandler(events, key, module[key]);
    }
  }

  return events;
}

async function importModule(source: string, bust: boolean): Promise<Record<string, unknown>> {
  if (!bust) {
    return (await import(pathToFileURL(source).href)) as Record<string, unknown>;
  }

  const temp = join(
    dirname(source),
    `${RELOAD_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}-${basename(source)}`
  );

  try {
    await copyFile(source, temp);
    return (await import(pathToFileURL(temp).href)) as Record<string, unknown>;
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

function assignHandler<K extends GatewayEventName>(
  events: BotEvents,
  key: K,
  value: unknown
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "function") {
    throw new Error(`[Draeven] Event ${key} must be a function.`);
  }

  if (events[key]) {
    throw new Error(`[Draeven] Event ${key} is defined more than once.`);
  }

  events[key] = value as BotEvents[K];
}
