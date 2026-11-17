/* Draeven Core: option and sub locales */

import { expect, test } from "vitest";
import { command, sub, withLocales, user, choice } from "./command.js";
import { startBot, type BotConnection } from "./bot.js";
import type { ApplicationCommandBody } from "@draeven/discord";

test("withLocales stores option description localizations", async () => {
  const greet = command(
    "greet",
    "Says hello",
    {
      who: withLocales(user("Who?"), { nl: { description: "Wie?", name: "wie" } }),
      mood: choice("Mood?", [{ label: "Happy", value: "happy", locales: { nl: "Blij" } }]),
    },
    async (ctx) => ctx.reply("hi"),
    { locales: { nl: { description: "Zegt hallo" } } }
  );

  let registered: readonly ApplicationCommandBody[] | undefined;
  const connection: BotConnection = {
    async start() {},
    async stop() {},
    readyUser() {
      return { id: "9", name: "Bot", bot: true, applicationId: "9" };
    },
    async registerCommands(commands) {
      registered = commands;
    },
    onCommand() {
      return () => undefined;
    },
    onUse() {
      return () => undefined;
    },
    async defer() {},
    async editReply() {
      return undefined;
    },
    async readHistory() {
      return { channel: { id: "1", name: "c", kind: "text" }, messages: [], truncated: false };
    },
    async readGuild() {
      return undefined;
    },
    async readRoles() {
      return [];
    },
    async readUser() {
      return undefined;
    },
    async replyTo() {},
  };

  const bot = await startBot(connection, { commands: [greet] });
  const body = registered?.[0];
  expect(body?.description_localizations).toEqual({ nl: "Zegt hallo" });
  expect(body?.options?.find((entry) => entry.name === "who")).toMatchObject({
    description_localizations: { nl: "Wie?" },
    name_localizations: { nl: "wie" },
  });
  expect(body?.options?.find((entry) => entry.name === "mood")).toMatchObject({
    choices: [{ name: "Happy", value: "happy", name_localizations: { nl: "Blij" } }],
  });
  await bot.stop();
});

test("sub locales land on Discord payloads", async () => {
  const mod = command("mod", "Mod tools", {
    ban: sub("Ban someone", async (ctx) => ctx.reply("ok"), {
      locales: { nl: "Ban iemand" },
    }),
  });

  let registered: readonly ApplicationCommandBody[] | undefined;
  const connection: BotConnection = {
    async start() {},
    async stop() {},
    readyUser() {
      return { id: "9", name: "Bot", bot: true, applicationId: "9" };
    },
    async registerCommands(commands) {
      registered = commands;
    },
    onCommand() {
      return () => undefined;
    },
    onUse() {
      return () => undefined;
    },
    async defer() {},
    async editReply() {
      return undefined;
    },
    async readHistory() {
      return { channel: { id: "1", name: "c", kind: "text" }, messages: [], truncated: false };
    },
    async readGuild() {
      return undefined;
    },
    async readRoles() {
      return [];
    },
    async readUser() {
      return undefined;
    },
    async replyTo() {},
  };

  const bot = await startBot(connection, { commands: [mod] });
  expect(registered?.[0]?.options?.[0]).toMatchObject({
    name: "ban",
    description_localizations: { nl: "Ban iemand" },
  });
  await bot.stop();
});
