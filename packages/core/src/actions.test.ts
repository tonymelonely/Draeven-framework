/* Draeven Core: moderation and message helpers */

import { expect, test, vi } from "vitest";
import { createActions } from "./actions.js";

test("message helpers work without a guild", async () => {
  const client = {
    pinMessage: vi.fn().mockResolvedValue(undefined),
    reactToMessage: vi.fn().mockResolvedValue(undefined),
    editChannelMessage: vi.fn().mockResolvedValue(undefined),
    deleteChannelMessage: vi.fn().mockResolvedValue(undefined),
  };

  const actions = createActions(undefined, client);
  expect(actions).toBeDefined();

  await actions!.pin("10", "20");
  await actions!.react({ id: "10" }, "20", "👍");
  await actions!.editMessage("10", "20", "hi");
  await actions!.deleteMessage("10", "20", "gone");

  expect(client.pinMessage).toHaveBeenCalledWith("10", "20");
  expect(client.reactToMessage).toHaveBeenCalledWith("10", "20", "👍");
  expect(client.editChannelMessage).toHaveBeenCalledWith("10", "20", { content: "hi" });
  expect(client.deleteChannelMessage).toHaveBeenCalledWith("10", "20", "gone");
});

test("guild helpers require a guild id", async () => {
  const actions = createActions(undefined, {
    kickMember: vi.fn(),
  });

  await expect(actions!.kick("1")).rejects.toThrow("A guild is required");
});

test("kick uses the guild and user id", async () => {
  const kickMember = vi.fn().mockResolvedValue(undefined);
  const actions = createActions("99", { kickMember });

  await actions!.kick({ id: "5" }, "bye");
  expect(kickMember).toHaveBeenCalledWith("99", "5", "bye");
});
