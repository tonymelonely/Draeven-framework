/* Draeven Core: tests for cooldowns */

import { expect, test } from "vitest";
import { command } from "./command.js";
import { CooldownBook, cooldownKey, readCooldown } from "./cooldown.js";
import { isMeta } from "./meta.js";

test("readCooldown accepts seconds or an object", () => {
  expect(readCooldown(5)).toEqual({ seconds: 5, scope: "user", private: true });
  expect(readCooldown({ seconds: 10, scope: "guild", private: false })).toEqual({
    seconds: 10,
    scope: "guild",
    private: false,
  });
});

test("isMeta allows cooldown", () => {
  expect(isMeta({ cooldown: 3 })).toBe(true);
  expect(isMeta({ cooldown: { seconds: 2, scope: "channel" } })).toBe(true);
});

test("command keeps cooldown meta", () => {
  const ping = command(
    "ping",
    "Checks whether the bot is alive",
    (ctx) => ctx.reply("pong"),
    { cooldown: 3 }
  );
  expect(ping.meta).toEqual({ cooldown: 3 });
});

test("CooldownBook blocks until the window ends", () => {
  const book = new CooldownBook();
  const now = 1_000_000;

  expect(book.take("ping:user:1", 5, now)).toBe(0);
  expect(book.take("ping:user:1", 5, now + 1000)).toBe(4);
  expect(book.take("ping:user:1", 5, now + 5000)).toBe(0);
});

test("cooldownKey builds scope ids", () => {
  expect(cooldownKey("ping", "user", { userId: "u1" })).toBe("ping:user:u1");
  expect(cooldownKey("ping", "guild", { userId: "u1", guildId: "g1" })).toBe(
    "ping:guild:g1"
  );
  expect(cooldownKey("ping", "channel", { userId: "u1", channelId: "c1" })).toBe(
    "ping:channel:c1"
  );
  expect(cooldownKey("ping", "guild", { userId: "u1" })).toBeUndefined();
});
