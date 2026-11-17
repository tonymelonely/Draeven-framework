/* Draeven Core: tests for collectors */

import { expect, test } from "vitest";
import { CollectorBook } from "./collect.js";
import { command, runCommand } from "./command.js";

test("CollectorBook resolves a matching id", async () => {
  const book = new CollectorBook();
  const pending = book.wait({ ids: ["yes", "no"], authorId: "1", seconds: 5 });

  expect(
    book.take({
      customId: "yes",
      author: { id: "1" },
      values: [],
      fields: {},
    })
  ).toMatchObject({ id: "yes", author: { id: "1" } });

  await expect(pending).resolves.toMatchObject({ id: "yes" });
});

test("CollectorBook ignores the wrong user", async () => {
  const book = new CollectorBook();
  const pending = book.wait({ ids: "yes", authorId: "1", seconds: 5 });

  expect(
    book.take({
      customId: "yes",
      author: { id: "2" },
      values: [],
      fields: {},
    })
  ).toBeUndefined();

  book.clear();
  await expect(pending).resolves.toBeUndefined();
});

test("collect is available on command ctx", async () => {
  const hits: string[] = [];

  const ask = command("ask", "Asks yes or no", async (ctx) => {
    const { wait, edit, collect, reply } = ctx;
    await wait();
    await edit("Pick one");
    const pick = await collect({ ids: ["yes", "no"], seconds: 1 });
    hits.push(pick?.id ?? "timeout");
    return reply(pick ? `chose ${pick.id}` : "timeout");
  });

  const sent = runCommand(ask, {
    author: { id: "1" },
    opt: {},
    wait: async () => undefined,
    edit: async () => undefined,
    collect: async () => ({ id: "yes", values: [], fields: {}, author: { id: "1" } }),
  });

  await expect(sent).resolves.toMatchObject({ text: "chose yes", deferred: true });
  expect(hits).toEqual(["yes"]);
});
