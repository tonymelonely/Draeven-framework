/* Draeven Core: wait for a button, menu, or form submit */

import type { UserRef } from "./lookup.js";

export type CollectKind = "press" | "submit";

export interface CollectOptions {
  /** Accept these custom ids. Required. */
  ids: string | readonly string[];
  /**
   * Who may press or submit. Defaults to the command author.
   * Pass false to allow anyone.
   */
  who?: UserRef | string | false;
  /** Seconds to wait. Defaults to 60. */
  seconds?: number;
  /** Limit to buttons/menus, form submits, or either. Defaults to any. */
  kind?: CollectKind | "any";
}

export interface Collected {
  /** The custom id that was pressed or submitted. */
  readonly id: string;
  readonly kind: CollectKind;
  /** Menu values. Empty for a plain button or form. */
  readonly values: readonly string[];
  /** Form fields by id. Empty for buttons and menus. */
  readonly fields: Readonly<Record<string, string>>;
  readonly author: UserRef;
  /** Present for form submits — the interaction that must be answered. */
  readonly interaction?: { id: string; token: string };
}

interface Waiter {
  ids: ReadonlySet<string>;
  kind: CollectKind | "any";
  who?: string;
  resolve: (value: Collected | undefined) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Pending collect() calls waiting for a matching component use. */
export class CollectorBook {
  private readonly waiters = new Set<Waiter>();

  wait(options: CollectOptions & { authorId: string }): Promise<Collected | undefined> {
    const ids = normalizeIds(options.ids);

    if (ids.size < 1) {
      throw new Error("[Draeven] collect() needs at least one id.");
    }

    const seconds = options.seconds ?? 60;

    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("[Draeven] collect() seconds must be a positive number.");
    }

    const who =
      options.who === false
        ? undefined
        : typeof options.who === "string"
          ? options.who.trim()
          : options.who
            ? options.who.id.trim()
            : options.authorId.trim();

    return new Promise<Collected | undefined>((resolve) => {
      const waiter: Waiter = {
        ids,
        kind: options.kind ?? "any",
        ...(who ? { who } : {}),
        resolve: (value) => {
          clearTimeout(waiter.timer);
          this.waiters.delete(waiter);
          resolve(value);
        },
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          resolve(undefined);
        }, seconds * 1000),
      };

      this.waiters.add(waiter);
    });
  }

  /** Try to resolve a waiting collect() for this component use. */
  take(use: {
    id: string;
    token: string;
    customId: string;
    kind: CollectKind;
    author: { id: string };
    values: readonly string[];
    fields: Readonly<Record<string, string>>;
  }): Collected | undefined {
    for (const waiter of this.waiters) {
      if (!waiter.ids.has(use.customId)) {
        continue;
      }

      if (waiter.kind !== "any" && waiter.kind !== use.kind) {
        continue;
      }

      if (waiter.who && waiter.who !== use.author.id) {
        continue;
      }

      const collected: Collected = {
        id: use.customId,
        kind: use.kind,
        values: [...use.values],
        fields: { ...use.fields },
        author: { id: use.author.id },
        ...(use.kind === "submit"
          ? { interaction: { id: use.id, token: use.token } }
          : {}),
      };

      waiter.resolve(collected);
      return collected;
    }

    return undefined;
  }

  clear(): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(undefined);
    }

    this.waiters.clear();
  }
}

function normalizeIds(ids: string | readonly string[]): Set<string> {
  const list = typeof ids === "string" ? [ids] : ids;
  const out = new Set<string>();

  for (const id of list) {
    const trimmed = id.trim();

    if (!trimmed) {
      throw new Error("[Draeven] collect() ids cannot be empty.");
    }

    out.add(trimmed);
  }

  return out;
}
