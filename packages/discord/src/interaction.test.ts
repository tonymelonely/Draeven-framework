/* Draeven Discord: tests for slash-command payloads */

import { expect, test } from "vitest";
import { readIncomingCommand, readIncomingUse } from "./interaction.js";

test("reads the caller and a selected user", () => {
  const command = readIncomingCommand({
    type: 2,
    id: "interaction",
    token: "token",
    guild_id: "10",
    channel_id: "11",
    member: {
      user: {
        id: "5",
        username: "tony_user",
        global_name: "Tony",
      },
    },
    data: {
      name: "userinfo",
      options: [{ type: 6, name: "user", value: "8" }],
      resolved: {
        users: {
          "8": { id: "8", username: "draeven", bot: true },
        },
      },
    },
  });

  expect(command).toEqual({
    id: "interaction",
    token: "token",
    name: "userinfo",
    author: { id: "5", name: "Tony", bot: false },
    members: {},
    options: [{ name: "user", kind: "user", userId: "8" }],
    users: [
      { id: "5", name: "Tony", bot: false },
      { id: "8", name: "draeven", bot: true },
    ],
    channels: [],
    roles: [],
    files: [],
    guildId: "10",
    channelId: "11",
  });
});

test("reads resolved members for a selected user", () => {
  const command = readIncomingCommand({
    type: 2,
    id: "interaction",
    token: "token",
    guild_id: "10",
    channel_id: "11",
    member: {
      user: { id: "5", username: "tony", global_name: "Tony" },
      nick: "T",
      roles: ["12"],
      joined_at: "2021-06-01T00:00:00.000Z",
    },
    data: {
      name: "userinfo",
      options: [{ type: 6, name: "user", value: "8" }],
      resolved: {
        users: {
          "8": { id: "8", username: "draeven", bot: true },
        },
        members: {
          "8": {
            nick: "Botty",
            roles: ["12", "13"],
            joined_at: "2024-05-06T00:00:00.000Z",
          },
        },
        roles: {
          "12": { id: "12", name: "member", color: 1, position: 1 },
          "13": { id: "13", name: "staff", color: 2, position: 2 },
        },
      },
    },
  });

  expect(command?.member).toEqual({
    nick: "T",
    roleIds: ["12"],
    joinedAt: new Date("2021-06-01T00:00:00.000Z"),
  });
  expect(command?.members?.["5"]).toEqual(command?.member);
  expect(command?.members?.["8"]).toEqual({
    nick: "Botty",
    roleIds: ["12", "13"],
    joinedAt: new Date("2024-05-06T00:00:00.000Z"),
  });
  expect(command?.roles).toEqual([
    { id: "12", name: "member", color: 1, position: 1 },
    { id: "13", name: "staff", color: 2, position: 2 },
  ]);
});

test("reads text, number, choice, channel, and role options", () => {
  const command = readIncomingCommand({
    type: 2,
    id: "interaction",
    token: "token",
    guild_id: "10",
    channel_id: "11",
    member: {
      user: { id: "5", username: "tony" },
    },
    data: {
      name: "ask",
      options: [
        { type: 3, name: "saying", value: "hello" },
        { type: 4, name: "times", value: 3 },
        { type: 3, name: "mood", value: "calm" },
        { type: 7, name: "where", value: "22" },
        { type: 8, name: "team", value: "33" },
      ],
      resolved: {
        channels: {
          "22": { id: "22", name: "general", type: 0 },
        },
        roles: {
          "33": { id: "33", name: "member" },
        },
      },
    },
  });

  expect(command?.options).toEqual([
    { name: "saying", kind: "string", value: "hello" },
    { name: "times", kind: "integer", value: 3 },
    { name: "mood", kind: "string", value: "calm" },
    { name: "where", kind: "channel", channelId: "22" },
    { name: "team", kind: "role", roleId: "33" },
  ]);
  expect(command?.channels).toEqual([{ id: "22", name: "general", type: 0 }]);
  expect(command?.roles).toEqual([{ id: "33", name: "member" }]);
  expect(command?.files).toEqual([]);
});

test("reads a focused autocomplete option", async () => {
  const { readIncomingSuggest } = await import("./interaction.js");

  const suggest = readIncomingSuggest({
    type: 4,
    id: "suggest",
    token: "token",
    member: { user: { id: "5", username: "tony" } },
    data: {
      name: "ask",
      options: [{ type: 3, name: "tag", value: "al", focused: true }],
    },
  });

  expect(suggest?.focused).toEqual({ name: "tag", typed: "al" });
});

test("ignores payloads that are not slash commands", () => {
  expect(readIncomingCommand({ type: 3, id: "1", token: "t" })).toBeUndefined();
});

test("reads a button press and a submitted form", () => {
  expect(
    readIncomingUse({
      type: 3,
      id: "press",
      token: "token",
      member: { user: { id: "5", username: "tony" } },
      data: { custom_id: "yes", component_type: 2 },
    })
  ).toEqual({
    id: "press",
    token: "token",
    customId: "yes",
    author: { id: "5", name: "tony", bot: false },
    kind: "press",
    users: [{ id: "5", name: "tony", bot: false }],
    values: [],
    fields: {},
  });

  expect(
    readIncomingUse({
      type: 5,
      id: "form",
      token: "token",
      user: { id: "5", username: "tony" },
      data: {
        custom_id: "ask",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "name", value: "Tony" }] },
        ],
      },
    })
  ).toMatchObject({ customId: "ask", fields: { name: "Tony" } });
});
