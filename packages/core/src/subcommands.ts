/* Draeven Core: subcommands and groups under a slash command */

import {
  storeOptions,
  type OptionMap,
  type OptOf,
  type StoredOption,
} from "./options.js";
import type { CommandContext, Reply } from "./command.js";

const NAME = /^[a-z0-9-]{1,32}$/;

export type SubRunner<TOpt> = (
  ctx: CommandContext<TOpt>
) => Reply | Promise<Reply>;

export interface StoredSub {
  readonly kind: "sub";
  readonly description: string;
  readonly options: Readonly<Record<string, StoredOption>>;
  readonly run: SubRunner<any>;
}

export interface StoredGroup {
  readonly kind: "group";
  readonly description: string;
  readonly subs: Readonly<Record<string, StoredSub>>;
}

export type StoredBranch = StoredSub | StoredGroup;

interface SubDraft<TOpt> {
  readonly kind: "sub";
  readonly description: string;
  readonly options: OptionMap;
  readonly run: SubRunner<TOpt>;
}

interface GroupDraft {
  readonly kind: "group";
  readonly description: string;
  readonly subs: Record<string, SubDraft<any>>;
}

export type SubMap = Record<string, SubDraft<any> | GroupDraft>;

/* One leaf under a command: /mod ban */
export function sub(
  description: string,
  run: SubRunner<{}>
): SubDraft<{}>;
export function sub<const TOptions extends OptionMap>(
  description: string,
  options: TOptions,
  run: SubRunner<OptOf<TOptions>>
): SubDraft<OptOf<TOptions>>;
export function sub(
  description: string,
  optionsOrRun: OptionMap | SubRunner<{}>,
  maybeRun?: SubRunner<OptOf<OptionMap>>
): SubDraft<any> {
  const text = readDescription(description);
  const options = typeof optionsOrRun === "function" ? {} : optionsOrRun;
  const run = typeof optionsOrRun === "function" ? optionsOrRun : maybeRun;

  if (!run) {
    throw new Error("[Draeven] A subcommand needs a run function.");
  }

  return {
    kind: "sub",
    description: text,
    options,
    run,
  };
}

/* A group of subs: /mod user ban */
export function group(
  description: string,
  subs: Record<string, SubDraft<any>>
): GroupDraft {
  const text = readDescription(description);

  if (Object.keys(subs).length < 1) {
    throw new Error("[Draeven] A group needs at least one subcommand.");
  }

  for (const [name, entry] of Object.entries(subs)) {
    if (!NAME.test(name)) {
      throw new Error(
        "[Draeven] Subcommand name must be 1-32 characters: lowercase letters, numbers, or hyphens."
      );
    }

    if (!entry || entry.kind !== "sub") {
      throw new Error("[Draeven] A group only holds sub() entries.");
    }
  }

  return {
    kind: "group",
    description: text,
    subs,
  };
}

export function storeSubs(subs: SubMap): Record<string, StoredBranch> {
  const stored: Record<string, StoredBranch> = {};

  for (const [name, entry] of Object.entries(subs)) {
    if (!NAME.test(name)) {
      throw new Error(
        "[Draeven] Subcommand name must be 1-32 characters: lowercase letters, numbers, or hyphens."
      );
    }

    if (entry.kind === "sub") {
      stored[name] = {
        kind: "sub",
        description: entry.description,
        options: storeOptions(entry.options),
        run: entry.run,
      };
      continue;
    }

    if (entry.kind === "group") {
      const nested: Record<string, StoredSub> = {};

      for (const [subName, child] of Object.entries(entry.subs)) {
        nested[subName] = {
          kind: "sub",
          description: child.description,
          options: storeOptions(child.options),
          run: child.run,
        };
      }

      stored[name] = {
        kind: "group",
        description: entry.description,
        subs: nested,
      };
      continue;
    }

    throw new Error("[Draeven] Unknown subcommand entry.");
  }

  return stored;
}

export function isSubMap(value: object): value is SubMap {
  const entries = Object.values(value);

  if (entries.length < 1) {
    return false;
  }

  return entries.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "kind" in entry &&
      (entry.kind === "sub" || entry.kind === "group")
  );
}

function readDescription(description: string): string {
  if (typeof description !== "string") {
    throw new Error("[Draeven] A subcommand description must be 1-100 characters.");
  }

  const trimmed = description.trim();

  if (!trimmed || trimmed.length > 100) {
    throw new Error("[Draeven] A subcommand description must be 1-100 characters.");
  }

  return trimmed;
}
