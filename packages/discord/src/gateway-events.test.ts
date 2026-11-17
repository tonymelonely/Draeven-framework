/* Draeven Discord: gateway event readers */

import { expect, test } from "vitest";
import { gatewayEventReaders, readGatewayMessage, readMemberJoin } from "./gateway-events.js";

test("reads member join and message payloads", () => {
  expect(
    readMemberJoin({
      guild_id: "1",
      user: { id: "2", username: "tony", bot: false },
      nick: "T",
      roles: ["9"],
    })
  ).toMatchObject({ id: "2", guildId: "1", nick: "T", roleIds: ["9"] });

  expect(
    readGatewayMessage({
      id: "10",
      channel_id: "11",
      content: "hi",
      author: { id: "2", username: "tony", bot: false },
    })
  ).toMatchObject({ id: "10", content: "hi" });
});

test("reaction and voice readers accept Discord shapes", () => {
  expect(
    gatewayEventReaders.reactionAdd.read({
      user_id: "1",
      message_id: "2",
      channel_id: "3",
      emoji: { name: "👍" },
    })
  ).toMatchObject({ userId: "1", emoji: { name: "👍" } });

  expect(
    gatewayEventReaders.voiceUpdate.read({
      guild_id: "1",
      user_id: "2",
      channel_id: "3",
      self_mute: true,
    })
  ).toMatchObject({ guildId: "1", selfMute: true });
});
