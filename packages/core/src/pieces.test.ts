/* Draeven Core: tests for buttons, menus, and forms */

import { expect, test } from "vitest";
import { canvas } from "./canvas.js";
import { command, runCommand, runPress } from "./command.js";
import { embed } from "./embed.js";
import {
  button,
  channels,
  discordForm,
  discordRows,
  form,
  link,
  mentions,
  menu,
  people,
  roles,
  row,
  sku,
  type ButtonColor,
  type Press,
} from "./pieces.js";

test("a row of buttons becomes Discord components", () => {
  const line = row(
    button({ id: "yes", label: "Yes", color: "green", emoji: "👍" }),
    link({ url: "https://discord.com", label: "Discord" }),
    sku({ id: "123" })
  );

  expect(discordRows([line])).toEqual([
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "Yes", custom_id: "yes", emoji: { name: "👍" } },
        { type: 2, style: 5, label: "Discord", url: "https://discord.com" },
        { type: 2, style: 6, sku_id: "123" },
      ],
    },
  ]);
});

test("menus take a row of their own", () => {
  const shade = row(
    menu({
      id: "shade",
      placeholder: "Pick a shade",
      choices: [
        { label: "Red", value: "red", description: "Warm", selected: true },
        { label: "Blue", value: "blue" },
      ],
    })
  );
  const person = row(people({ id: "person", placeholder: "Who?", min: 0, max: 2 }));
  const room = row(channels({ id: "room", kinds: ["text", "voice"] }));
  const role = row(roles({ id: "role" }));
  const mention = row(mentions({ id: "mention" }));

  expect(discordRows([shade, person, room, role, mention])).toEqual([
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: "shade",
          placeholder: "Pick a shade",
          min_values: 1,
          max_values: 1,
          options: [
            { label: "Red", value: "red", description: "Warm", default: true },
            { label: "Blue", value: "blue" },
          ],
        },
      ],
    },
    {
      type: 1,
      components: [
        {
          type: 5,
          custom_id: "person",
          placeholder: "Who?",
          min_values: 0,
          max_values: 2,
        },
      ],
    },
    {
      type: 1,
      components: [
        {
          type: 8,
          custom_id: "room",
          min_values: 1,
          max_values: 1,
          channel_types: [0, 2],
        },
      ],
    },
    {
      type: 1,
      components: [{ type: 6, custom_id: "role", min_values: 1, max_values: 1 }],
    },
    {
      type: 1,
      components: [{ type: 7, custom_id: "mention", min_values: 1, max_values: 1 }],
    },
  ]);
});

test("a form is a popup", () => {
  const ask = form({
    id: "ask",
    title: "A question",
    fields: [
      { id: "name", label: "Your name", placeholder: "Tony" },
      { id: "why", label: "Why?", style: "long", required: false, max: 200 },
    ],
  });

  expect(discordForm(ask)).toEqual({
    custom_id: "ask",
    title: "A question",
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: "name",
            label: "Your name",
            style: 1,
            required: true,
            placeholder: "Tony",
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: "why",
            label: "Why?",
            style: 2,
            required: false,
            max_length: 200,
          },
        ],
      },
    ],
  });
});

test("a reply can carry a row, and a press can open a form", async () => {
  const ask = form({
    id: "ask",
    title: "Ask",
    fields: [{ id: "name", label: "Name" }],
    submit: async (ctx) => {
      const { reply, fields } = ctx;
      return reply(fields.name ?? "");
    },
  });
  const open: Press = async (ctx) => {
    const { reply } = ctx;
    return reply(ask);
  };
  const yes = button({
    id: "yes",
    label: "Yes",
    press: open,
  });
  const show = command("show", "Shows a row", async (ctx) => {
    const { reply } = ctx;
    return reply(row(yes));
  });
  const sent = await runCommand(show, { author: { id: "1" }, opt: {} });

  expect(sent.rows).toHaveLength(1);

  const opened = await runPress(open, {
    author: { id: "1" },
    values: [],
    fields: {},
  });

  expect(opened.form).toBe(ask);
});

test("a card carries its rows and picture into the reply", async () => {
  const picture = canvas({ width: 2, height: 2 });
  const line = row(button({ id: "server", label: "Server" }));
  const card = embed({
    header: { title: "Tony" },
    rows: [line],
    picture,
  });
  const show = command("show", "Shows a card", async (ctx) => {
    const { reply } = ctx;
    return reply(card);
  });
  const sent = await runCommand(show, { author: { id: "1" }, opt: {} });

  expect(sent.embed).toBe(card);
  expect(sent.rows).toEqual([line]);
  expect(sent.picture).toBe(picture);
});

test("rejects a menu beside a button and an unknown button color", () => {
  const yes = button({ id: "yes", label: "Yes" });
  const shade = menu({
    id: "shade",
    placeholder: "Pick",
    choices: [{ label: "Red", value: "red" }],
  });

  expect(() => row(yes, shade)).toThrow("A menu takes the whole row.");
  expect(() => button({ id: "x", label: "X", color: "pink" as ButtonColor })).toThrow(
    "blurple, grey, green, or red"
  );
});
