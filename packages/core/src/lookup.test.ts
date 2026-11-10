/* Draeven Core: tests for the command lookups */

import { expect, test } from "vitest";
import { command, runCommand } from "./command.js";
import type { Channel, Guild, Member, Role, User } from "./lookup.js";

const tony: User = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

const draeven: User = {
  id: "2",
  name: "Draeven",
  createdAt: new Date(Date.UTC(2024, 4, 6)),
  bot: true,
};

const guild: Guild = { id: "10", name: "Home" };
const channel: Channel = { id: "11", name: "general", kind: "text" };
const memberRole: Role = { id: "12", name: "member", color: 0x57f287, position: 3 };
const member: Member = {
  id: tony.id,
  nick: "T",
  joinedAt: new Date(Date.UTC(2021, 5, 1)),
  roles: [memberRole],
};

const where = command("where", "Shows where the command ran", async (ctx) => {
  const person = ctx.getUser(ctx.author);
  const bot = ctx.getBot();
  const server = ctx.getGuild();
  const room = ctx.getChannel();
  const roles = ctx.getRoles(ctx.author);
  const guildMember = ctx.getMember(ctx.author);

  return ctx.reply(
    [
      person.name,
      bot.name,
      server?.name ?? "dm",
      `${room?.name ?? "none"}:${room?.kind ?? "none"}`,
      roles.map((role) => `${role.name}:${role.color ?? 0}:${role.position ?? 0}`).join(","),
      guildMember?.nick ?? "no-nick",
    ].join("\n")
  );
});

test("lookups resolve the bot, guild, channel, member, and roles", async () => {
  const reply = await runCommand(where, {
    author: { id: tony.id },
    users: [tony, draeven],
    bot: { id: draeven.id },
    guild,
    channel,
    members: { [tony.id]: member },
    roles: { [tony.id]: [memberRole] },
    knownRoles: [memberRole],
    opt: {},
  });

  expect(reply.text).toBe(
    ["Tony", "Draeven", "Home", "general:text", `member:${0x57f287}:3`, "T"].join("\n")
  );
});

test("a direct message has no guild, channel, or roles", async () => {
  const reply = await runCommand(where, {
    author: { id: tony.id },
    users: [tony, draeven],
    bot: { id: draeven.id },
    opt: {},
  });

  expect(reply.text).toBe(
    ["Tony", "Draeven", "dm", "none:none", "", "no-nick"].join("\n")
  );
});

test("an unknown user cannot be resolved", async () => {
  const missing = command("missing", "Looks up nobody", (ctx) => {
    ctx.getUser({ id: "404" });
    return ctx.reply("ok");
  });

  await expect(
    runCommand(missing, {
      author: { id: tony.id },
      users: [tony],
      opt: {},
    })
  ).rejects.toThrow("Unknown user 404.");
});
