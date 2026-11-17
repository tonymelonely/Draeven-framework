/* Draeven Core: simulate() without Discord */

import { expect, test } from "vitest";
import { command, text } from "./command.js";
import { simulate } from "./simulate.js";

test("simulate runs a command and returns its reply", async () => {
  const ping = command("ping", "Checks the bot", async (ctx) => ctx.reply("pong"));
  const reply = await simulate(ping, { author: { id: "1" } });
  expect(reply.text).toBe("pong");
});

test("simulate passes locale and options", async () => {
  const greet = command(
    "greet",
    "Says hi",
    { note: text("Note?") },
    async (ctx) => ctx.reply(`${ctx.locale ?? "none"}:${ctx.note ?? ""}`)
  );

  const reply = await simulate(greet, {
    author: { id: "1" },
    locale: "nl",
    opt: { note: "hey" },
  });

  expect(reply.text).toBe("nl:hey");
});
