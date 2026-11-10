/* Draeven Core: private replies, followups, and send */

import { expect, test } from "vitest";
import { command, runCommand } from "./command.js";

const tony = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

test("reply can be private", async () => {
  const whisper = command("whisper", "Says something private", async (ctx) => {
    const { reply } = ctx;
    return reply("secret", { private: true });
  });

  const sent = await runCommand(whisper, {
    author: { id: tony.id },
    users: [tony],
    opt: {},
  });

  expect(sent).toEqual({ text: "secret", private: true });
});

test("followup queues after the first reply", async () => {
  const chain = command("chain", "Replies twice", async (ctx) => {
    const { reply, followup } = ctx;
    const sent = reply("first");
    await followup("second", { private: true });
    return sent;
  });

  const sent = await runCommand(chain, {
    author: { id: tony.id },
    users: [tony],
    opt: {},
  });

  expect(sent.text).toBe("first");
  expect(sent.followups).toEqual([{ text: "second", private: true }]);
});

test("send posts to a channel through the injected sender", async () => {
  const posted: { channelId: string; text?: string }[] = [];

  const announce = command("shout", "Sends to a channel", async (ctx) => {
    const { reply, send } = ctx;
    await send("99", "hello channel");
    return reply("done");
  });

  const sent = await runCommand(announce, {
    author: { id: tony.id },
    users: [tony],
    opt: {},
    send: async (channelId, message) => {
      posted.push({ channelId, text: message.text });
    },
  });

  expect(sent.text).toBe("done");
  expect(posted).toEqual([{ channelId: "99", text: "hello channel" }]);
});
