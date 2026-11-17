/* Draeven Core: wait for a button or menu press */

import type { UserRef } from "./lookup.js";

export interface CollectOptions {
  /** Accept these custom ids. Required. */
  ids: string | readonly string[];
  /**
   * Who may press. Defaults to the command author.
   * Pass false to allow anyone.
   */
  who?: UserRef | string | false;
  /** Seconds to wait. Defaults to 60. */
  seconds?: number;
}

export interface Collected {
  /** The custom id that was pressed or submitted. */
  readonly id: string;
  /** Menu values. Empty for a plain button. */
  readonly values: readonly string[];
  /** Form fields by id. Empty for buttons and menus. */
  readonly fields: Readonly<Record<string, string>>;
  readonly author: UserRef;
}

interface Waiter {
  ids: ReadonlySet<string>;
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
    customId: string;
    author: { id: string };
    values: readonly string[];
    fields: Readonly<Record<string, string>>;
  }): Collected | undefined {
    for (const waiter of this.waiters) {
      if (!waiter.ids.has(use.customId)) {
        continue;
      }

      if (waiter.who && waiter.who !== use.author.id) {
        continue;
      }

      const collected: Collected = {
        id: use.customId,
        values: [...use.values],
        fields: { ...use.fields },
        author: { id: use.author.id },
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
