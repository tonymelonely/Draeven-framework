/* Draeven Core: durable component handlers (buttons, menus, forms) */

import { useMark } from "./marks.js";
import type { Press, PressContext } from "./pieces.js";

export type UseIds = string | readonly string[] | ((id: string) => boolean);

export type UseKind = "press" | "submit";

export interface UseOptions {
  /**
   * Which custom ids this handler owns.
   * - `"hangman_A"` — exact id
   * - `"hangman_*"` — prefix (`*` only at the end)
   * - `["yes", "no"]` — any of these exact ids
   * - `(id) => boolean` — your own match
   */
  ids: UseIds;
  /** Default `"press"`. Use `"submit"` for form handlers. */
  kind?: UseKind;
  run: Press;
}

export interface Use {
  readonly ids: UseIds;
  readonly kind: UseKind;
  readonly run: Press;
}

/* Build a durable component handler. Load it from the events folder like a command. */
export function use(options: UseOptions): Use {
  if (!options || typeof options !== "object") {
    throw new Error("[Draeven] use() needs { ids, run }.");
  }

  if (options.ids === undefined || options.ids === null) {
    throw new Error("[Draeven] use() needs ids.");
  }

  if (typeof options.ids === "string" && !options.ids.trim()) {
    throw new Error("[Draeven] use() ids cannot be empty.");
  }

  if (Array.isArray(options.ids)) {
    if (options.ids.length === 0) {
      throw new Error("[Draeven] use() ids cannot be an empty list.");
    }

    for (const id of options.ids) {
      if (typeof id !== "string" || !id.trim()) {
        throw new Error("[Draeven] use() ids must be non-empty strings.");
      }
    }
  }

  if (
    typeof options.ids !== "string" &&
    !Array.isArray(options.ids) &&
    typeof options.ids !== "function"
  ) {
    throw new Error("[Draeven] use() ids must be a string, a list, or a function.");
  }

  if (typeof options.run !== "function") {
    throw new Error("[Draeven] use() needs run(ctx).");
  }

  const kind = options.kind ?? "press";

  if (kind !== "press" && kind !== "submit") {
    throw new Error('[Draeven] use() kind must be "press" or "submit".');
  }

  return Object.freeze({
    [useMark]: true,
    ids: options.ids,
    kind,
    run: options.run,
  }) as Use;
}

export function isUse(value: unknown): value is Use {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [useMark]?: unknown })[useMark] === true
  );
}

/* True when this use() owns the custom id for this kind. */
export function useMatches(entry: Use, customId: string, kind: UseKind): boolean {
  if (entry.kind !== kind) {
    return false;
  }

  return idMatches(entry.ids, customId);
}

export function findUse(
  entries: readonly Use[],
  customId: string,
  kind: UseKind
): Use | undefined {
  for (const entry of entries) {
    if (useMatches(entry, customId, kind)) {
      return entry;
    }
  }

  return undefined;
}

function idMatches(spec: UseIds, id: string): boolean {
  if (typeof spec === "function") {
    return spec(id) === true;
  }

  if (typeof spec === "string") {
    if (spec.endsWith("*")) {
      return id.startsWith(spec.slice(0, -1));
    }

    return id === spec;
  }

  return spec.includes(id);
}

export type { PressContext };
