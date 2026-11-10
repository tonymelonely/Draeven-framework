/* Draeven Core: tests for command() */

import { expect, expectTypeOf, test } from "vitest";
import { command, runCommand, user } from "./command.js";
import type { User } from "./lookup.js";

const tony: User = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

test("a command without options replies immediately", async () => {
  const ping = command("ping", "Checks whether the bot is alive", (ctx) => {
    expectTypeOf(ctx.opt).toEqualTypeOf<{}>();
    return ctx.reply("pong");
  });

  const reply = await runCommand(ping, {
    author: { id: tony.id },
    opt: {},
  });

  expect(reply.text).toBe("pong");
});

test("required() makes a user option mandatory", () => {
  const ban = command(
    "ban",
    "Removes someone",
    { user: user("Who?").required() },
    (ctx) => {
      expectTypeOf(ctx.user).toEqualTypeOf<User>();
      return ctx.reply(ctx.user.name);
    }
  );

  expect(ban.options.user).toEqual({
    kind: "user",
    question: "Who?",
    required: true,
  });
});

test("a command name outside the pattern is rejected", () => {
  expect(() =>
    command("UserInfo", "Shows who someone is", (ctx) => ctx.reply("no"))
  ).toThrow("Command name must be 1-32 characters");
});

test("a command must reply", async () => {
  const silent = command("silent", "Says nothing", () => {
    return undefined as never;
  });

  await expect(
    runCommand(silent, { author: { id: tony.id }, opt: {} })
  ).rejects.toThrow("The command did not reply.");
});
