/* Draeven Core: subcommands and groups under a slash command */

import { readLocaleMap } from "./locale.js";
import {
  storeOptions,
  type OptionLocaleInput,
  type OptionMap,
  type OptOf,
  type StoredOption,
} from "./options.js";
import type { CommandContext, Reply } from "./command.js";

const NAME = /^[a-z0-9-]{1,32}$/;

export type SubRunner<TOpt> = (
  ctx: CommandContext<TOpt>
) => Reply | Promise<Reply>;

export interface BranchLocales {
  /** `{ nl: "Ban iemand" }` or `{ nl: { description, name } }`. */
  locales?: OptionLocaleInput;
}

export interface StoredSub {
  readonly kind: "sub";
  readonly description: string;
  readonly options: Readonly<Record<string, StoredOption>>;
  readonly run: SubRunner<any>;
  readonly locales?: Readonly<Record<string, string>>;
  readonly names?: Readonly<Record<string, string>>;
}

export interface StoredGroup {
  readonly kind: "group";
  readonly description: string;
  readonly subs: Readonly<Record<string, StoredSub>>;
  readonly locales?: Readonly<Record<string, string>>;
  readonly names?: Readonly<Record<string, string>>;
}
export type StoredBranch = StoredSub | StoredGroup;

interface SubDraft<TOpt> {
  readonly kind: "sub";
  readonly description: string;
  readonly options: OptionMap;
  readonly run: SubRunner<TOpt>;
  readonly locales?: Readonly<Record<string, string>>;
  readonly names?: Readonly<Record<string, string>>;
}

interface GroupDraft {
  readonly kind: "group";
  readonly description: string;
  readonly subs: Record<string, SubDraft<any>>;
  readonly locales?: Readonly<Record<string, string>>;
  readonly names?: Readonly<Record<string, string>>;
}

export type SubMap = Record<string, SubDraft<any> | GroupDraft>;

/* One leaf under a command: /mod ban */
export function sub(
  description: string,
  run: SubRunner<{}>,
  meta?: BranchLocales
): SubDraft<{}>;
export function sub<const TOptions extends OptionMap>(
  description: string,
  options: TOptions,
  run: SubRunner<OptOf<TOptions>>,
  meta?: BranchLocales
): SubDraft<OptOf<TOptions>>;
export function sub(
  description: string,
  optionsOrRun: OptionMap | SubRunner<{}>,
  maybeRunOrMeta?: SubRunner<OptOf<OptionMap>> | BranchLocales,
  maybeMeta?: BranchLocales
): SubDraft<any> {
  const text = readDescription(description);

  if (typeof optionsOrRun === "function") {
    const meta = isBranchLocales(maybeRunOrMeta) ? maybeRunOrMeta : undefined;
    const i18n = readBranchLocales(meta?.locales, "subcommand");

    return {
      kind: "sub",
      description: text,
      options: {},
      run: optionsOrRun,
      ...i18n,
    };
  }

  if (typeof maybeRunOrMeta !== "function") {
    throw new Error("[Draeven] A subcommand needs a run function.");
  }

  const i18n = readBranchLocales(maybeMeta?.locales, "subcommand");

  return {
    kind: "sub",
    description: text,
    options: optionsOrRun,
    run: maybeRunOrMeta,
    ...i18n,
  };
}

/* A group of subs: /mod user ban */
export function group(
  description: string,
  subs: Record<string, SubDraft<any>>,
  meta?: BranchLocales
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

  const i18n = readBranchLocales(meta?.locales, "group");

  return {
    kind: "group",
    description: text,
    subs,
    ...i18n,
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
        ...(entry.locales ? { locales: entry.locales } : {}),
        ...(entry.names ? { names: entry.names } : {}),
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
          ...(child.locales ? { locales: child.locales } : {}),
          ...(child.names ? { names: child.names } : {}),
        };
      }

      stored[name] = {
        kind: "group",
        description: entry.description,
        subs: nested,
        ...(entry.locales ? { locales: entry.locales } : {}),
        ...(entry.names ? { names: entry.names } : {}),
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

function isBranchLocales(value: unknown): value is BranchLocales {
  return typeof value === "object" && value !== null && !("kind" in value);
}

function readBranchLocales(
  map: OptionLocaleInput | undefined,
  label: string
): { locales?: Record<string, string>; names?: Record<string, string> } {
  if (!map) {
    return {};
  }

  const descriptions: Record<string, string> = {};
  const names: Record<string, string> = {};

  for (const [locale, value] of Object.entries(map)) {
    if (typeof value === "string") {
      descriptions[locale] = value;
      continue;
    }

    if (value.description !== undefined) {
      descriptions[locale] = value.description;
    }

    if (value.name !== undefined) {
      names[locale] = value.name;
    }
  }

  const locales = readLocaleMap(descriptions, label);
  const nameLocales = readLocaleMap(names, `${label} name`);

  return {
    ...(locales ? { locales } : {}),
    ...(nameLocales ? { names: nameLocales } : {}),
  };
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
