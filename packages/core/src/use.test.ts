/* Draeven Core: tests for use() */

import { expect, test } from "vitest";
import { findUse, isUse, use, useMatches } from "./use.js";

test("use() builds a marked handler", () => {
  const hangman = use({
    ids: "hangman_*",
    run: (ctx) => ctx.reply(ctx.id),
  });

  expect(isUse(hangman)).toBe(true);
  expect(hangman.kind).toBe("press");
  expect(useMatches(hangman, "hangman_A", "press")).toBe(true);
  expect(useMatches(hangman, "hangman_A", "submit")).toBe(false);
  expect(useMatches(hangman, "other", "press")).toBe(false);
});

test("use() matches exact ids and lists", () => {
  const one = use({ ids: "yes", run: (ctx) => ctx.reply("ok") });
  const many = use({ ids: ["a", "b"], run: (ctx) => ctx.reply("ok") });

  expect(useMatches(one, "yes", "press")).toBe(true);
  expect(useMatches(one, "no", "press")).toBe(false);
  expect(useMatches(many, "b", "press")).toBe(true);
  expect(useMatches(many, "c", "press")).toBe(false);
});

test("findUse returns the first match", () => {
  const first = use({ ids: "hangman_*", run: (ctx) => ctx.reply("1") });
  const second = use({ ids: "hangman_Z", run: (ctx) => ctx.reply("2") });

  expect(findUse([first, second], "hangman_Z", "press")).toBe(first);
  expect(findUse([second, first], "hangman_Z", "press")).toBe(second);
});

test("use() rejects bad options", () => {
  expect(() => use({ ids: "", run: (ctx) => ctx.reply("x") })).toThrow(/ids/);
  expect(() => use({ ids: "x", run: undefined as never })).toThrow(/run/);
});
