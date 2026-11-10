/* Draeven Core: wait / edit / remove */

import { expect, test } from "vitest";
import { command, runCommand } from "./command.js";

const tony = {
  id: "1",
  name: "Tony",
  createdAt: new Date(),
  bot: false,
};

test("wait marks the reply as deferred", async () => {
  const calls: string[] = [];

  const ping = command("ping", "Waits then replies", async (ctx) => {
    const { wait, reply } = ctx;
    await wait();
    return reply("pong");
  });

  const sent = await runCommand(ping, {
    author: { id: tony.id },
    users: [tony],
    opt: {},
    wait: async () => {
      calls.push("wait");
    },
  });

  expect(calls).toEqual(["wait"]);
  expect(sent).toMatchObject({ text: "pong", deferred: true });
});

test("edit replaces the deferred reply body", async () => {
  const edits: string[] = [];

  const work = command("work", "Edits while waiting", async (ctx) => {
    const { wait, edit, reply } = ctx;
    await wait();
    await edit("halfway");
    return reply("done");
  });

  const sent = await runCommand(work, {
    author: { id: tony.id },
    users: [tony],
    opt: {},
    wait: async () => undefined,
    edit: async (message) => {
      edits.push(message.text ?? "");
    },
  });

  expect(edits).toEqual(["halfway"]);
  expect(sent.text).toBe("done");
});
