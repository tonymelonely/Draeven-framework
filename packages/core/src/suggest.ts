/* Draeven Core: autocomplete suggestions for text and number options */

import type { Lookups, UserRef } from "./lookup.js";

export type SuggestItem = string | { label: string; value: string | number };

export interface SuggestContext extends Lookups {
  author: UserRef;
  /** Characters the caller has typed so far. */
  typed: string;
  /** Option name Discord is focusing. */
  focused: string;
}

export type SuggestHandler = (
  ctx: SuggestContext
) => SuggestItem[] | Promise<SuggestItem[]>;

export interface DiscordSuggestChoice {
  name: string;
  value: string | number;
}

/* Turn author suggestions into Discord autocomplete choices (max 25). */
export function toSuggestChoices(
  items: readonly SuggestItem[],
  kind: "text" | "number" | "decimal"
): DiscordSuggestChoice[] {
  if (!Array.isArray(items)) {
    throw new Error("[Draeven] A suggest handler must return a list.");
  }

  const choices: DiscordSuggestChoice[] = [];

  for (const item of items.slice(0, 25)) {
    choices.push(readSuggestItem(item, kind));
  }

  return choices;
}

function readSuggestItem(
  item: SuggestItem,
  kind: "text" | "number" | "decimal"
): DiscordSuggestChoice {
  if (typeof item === "string") {
    const value = item.trim();

    if (!value || value.length > 100) {
      throw new Error("[Draeven] A suggestion must be 1-100 characters.");
    }

    if (kind === "number" || kind === "decimal") {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        throw new Error("[Draeven] A number suggestion must be a finite number.");
      }

      return { name: value, value: number };
    }

    return { name: value, value };
  }

  if (typeof item !== "object" || item === null) {
    throw new Error("[Draeven] A suggestion is a string, or { label, value }.");
  }

  const label = typeof item.label === "string" ? item.label.trim() : "";

  if (!label || label.length > 100) {
    throw new Error("[Draeven] A suggestion label must be 1-100 characters.");
  }

  if (kind === "number" || kind === "decimal") {
    if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
      throw new Error("[Draeven] A number suggestion value must be a finite number.");
    }

    return { name: label, value: item.value };
  }

  if (typeof item.value !== "string") {
    throw new Error("[Draeven] A text suggestion value must be a string.");
  }

  const value = item.value.trim();

  if (!value || value.length > 100) {
    throw new Error("[Draeven] A suggestion value must be 1-100 characters.");
  }

  return { name: label, value };
}
