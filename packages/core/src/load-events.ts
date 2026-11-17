/* Draeven Core: load gateway event handlers from a folder */

import { copyFile, readdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { GatewayMember, GatewayMessage } from "@draeven/discord";

export interface BotEvents {
  memberJoin?: (member: GatewayMember) => void | Promise<void>;
  memberLeave?: (member: GatewayMember) => void | Promise<void>;
  message?: (message: GatewayMessage) => void | Promise<void>;
}

/* Import each .js module and merge memberJoin / memberLeave / message exports. */
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
    .filter((name) => !name.startsWith("."))
    .sort((left, right) => left.localeCompare(right));

  const events: BotEvents = {};

  for (const file of files) {
    const module = await importModule(join(dir, file), options?.bust === true);

    assignHandler(events, "memberJoin", module.memberJoin);
    assignHandler(events, "memberLeave", module.memberLeave);
    assignHandler(events, "message", module.message);
  }

  return events;
}

async function importModule(source: string, bust: boolean): Promise<Record<string, unknown>> {
  if (!bust) {
    return (await import(pathToFileURL(source).href)) as Record<string, unknown>;
  }

  const temp = join(tmpdir(), `draeven-reload-${Date.now()}-${Math.random().toString(16).slice(2)}.js`);

  try {
    await copyFile(source, temp);
    return (await import(pathToFileURL(temp).href)) as Record<string, unknown>;
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

function assignHandler<K extends keyof BotEvents>(
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
