/* Draeven Discord: tests for walking a channel's messages */

import { expect, test } from "vitest";
import { collectMessages, describeChannel } from "./history.js";

test("reads a channel name and walks older pages", async () => {
  expect(describeChannel({ id: "11", name: "general", type: 0, topic: "Hi", guild_id: "42" }, "11")).toEqual({
    id: "11",
    name: "general",
    kind: "text",
    topic: "Hi",
    guildId: "42",
  });

  const first = Array.from({ length: 100 }, (_item, index) => ({ id: String(200 - index) }));
  const second = [{ id: "50" }, { id: "49" }];
  const calls: Array<string | undefined> = [];

  const collected = await collectMessages(
    async (before) => {
      calls.push(before);
      return before ? second : first;
    },
    { pauseMs: 0 }
  );

  expect(calls).toEqual([undefined, "101"]);
  expect(collected.truncated).toBe(false);
  expect(collected.messages).toHaveLength(102);
});
