/* Draeven Core: tests for subcommands */

import { expect, test } from "vitest";
import { command, runCommand, sub, group, user } from "./command.js";
import type { User } from "./lookup.js";

const tony: User = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

test("subcommands store and run the chosen leaf", async () => {
  const mod = command("mod", "Moderation tools", {
    ban: sub("Ban a user", { who: user("Who?").required() }, async (ctx) => {
      const { who, reply } = ctx;
      return reply(`ban:${who.name}`);
    }),
    kick: sub("Kick a user", async (ctx) => {
      const { reply } = ctx;
      return reply("kick");
    }),
  });

  expect(Object.keys(mod.subs)).toEqual(["ban", "kick"]);
  expect(mod.options).toEqual({});

  const ban = mod.subs.ban;
  expect(ban.kind).toBe("sub");
  if (ban.kind !== "sub") {
    throw new Error("expected sub");
  }

  const reply = await runCommand(
    { run: ban.run },
    {
      author: { id: tony.id },
      users: [tony],
      opt: { who: tony },
    }
  );

  expect(reply.text).toBe("ban:Tony");
});

test("groups only hold subcommands", () => {
  const mod = command("mod", "Moderation tools", {
    user: group("User actions", {
      ban: sub("Ban a user", async (ctx) => {
        const { reply } = ctx;
        return reply("ban");
      }),
    }),
  });

  expect(mod.subs.user).toMatchObject({
    kind: "group",
    description: "User actions",
  });
});
