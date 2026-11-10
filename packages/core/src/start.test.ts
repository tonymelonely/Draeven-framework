
/* Draeven Core: tests for Start() */

import { expect, test } from "vitest";
import { command } from "./command.js";
import { Start } from "./index.js";

test("Start rejects an empty token", async () => {
  await expect(
    Start({ token: "   " })
  ).rejects.toThrow("Missing Discord token");
});

test("Start rejects two commands with the same name", async () => {
  const ping = command("ping", "Checks whether the bot is alive", (ctx) =>
    ctx.reply("pong")
  );

  await expect(
    Start({ token: "test-token", commands: [ping, ping] })
  ).rejects.toThrow("Command ping is defined more than once.");
});
