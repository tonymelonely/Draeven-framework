/* Draeven Core: tests for embed() */

import { expect, test } from "vitest";
import { command, runCommand } from "./command.js";
import { breakline, colors, embed, time, type Color, type EmbedFieldInput } from "./embed.js";

const created = new Date(Date.UTC(2020, 2, 5, 16, 20, 30));

test("fields share a row until breakline", () => {
  const card = embed({
    header: { title: "Server Information" },
    description: "Welcome to our community",
    fields: [
      { name: "Members", value: 128 },
      { name: "Channels", value: 24 },
      breakline,
      { name: "Roles", value: 12 },
      { name: "Created", value: time(created, "D") },
      { name: "Online", value: 37 },
      breakline,
      { name: "Boosts", value: 3 },
    ],
  });

  expect(card.fields).toEqual([
    { name: "Members", value: "128", inline: true },
    { name: "Channels", value: "24", inline: true },
    { name: "\u200b", value: "\u200b", inline: true },
    { name: "Roles", value: "12", inline: true },
    { name: "Created", value: time(created, "long date"), inline: true },
    { name: "Online", value: "37", inline: true },
    { name: "Boosts", value: "3", inline: true },
  ]);
});

test("wide takes the whole row and the short row above stays short", () => {
  const card = embed({
    header: { title: "Notes" },
    fields: [
      { name: "Members", value: 1 },
      { name: "Channels", value: 2 },
      { name: "About", value: "The whole row", wide: true },
      { name: "Boosts", value: 3 },
    ],
  });

  expect(card.fields).toEqual([
    { name: "Members", value: "1", inline: true },
    { name: "Channels", value: "2", inline: true },
    { name: "About", value: "The whole row", inline: false },
    { name: "Boosts", value: "3", inline: true },
  ]);
});

test("a card keeps every other embed part", () => {
  const card = embed({
    color: "blurple",
    author: {
      name: "Draeven",
      icon: "https://cdn.discordapp.com/embed/avatars/0.png",
      link: "https://discord.com",
    },
    header: {
      title: "Server Information",
      link: "https://discord.com/servers",
      image: "https://cdn.discordapp.com/embed/avatars/1.png",
    },
    description: "Welcome",
    image: "https://cdn.discordapp.com/embed/avatars/2.png",
    footer: {
      text: "Draeven",
      icon: "https://cdn.discordapp.com/embed/avatars/3.png",
    },
    timestamp: created,
    fields: [
      { name: "Open", value: false },
      { name: "Since", value: created },
    ],
  });

  expect(card.color).toBe(0x5865f2);
  expect(embed({ header: { title: "Hi" }, color: "#abc" as Color }).color).toBe(0xaabbcc);
  expect(embed({ header: { title: "Hi" }, color: colors.green }).color).toBe(0x008000);
  expect(embed({ header: { title: "Hi" }, color: colors.rebeccapurple }).color).toBe(0x663399);
  expect(card.author).toEqual({
    name: "Draeven",
    icon: "https://cdn.discordapp.com/embed/avatars/0.png",
    link: "https://discord.com",
  });
  expect(card.header).toEqual({
    title: "Server Information",
    link: "https://discord.com/servers",
    image: "https://cdn.discordapp.com/embed/avatars/1.png",
  });
  expect(card.timestamp).toBe(created.toISOString());
  expect(card.image).toBe("https://cdn.discordapp.com/embed/avatars/2.png");
  expect(card.footer).toEqual({
    text: "Draeven",
    icon: "https://cdn.discordapp.com/embed/avatars/3.png",
  });
  expect(card.fields).toEqual([
    { name: "Open", value: "no", inline: true },
    { name: "Since", value: time(created, "long date"), inline: true },
  ]);
});

test("time styles cover the short forms and the words", () => {
  expect(time(created, "t")).toBe(`<t:${Math.floor(created.getTime() / 1000)}:t>`);
  expect(time(created, "time")).toBe(time(created, "t"));
  expect(time(created, "T")).toBe(time(created, "long time"));
  expect(time(created, "d")).toBe(time(created, "date"));
  expect(time(created, "D")).toBe(time(created, "long date"));
  expect(time(created, "f")).toBe(time(created, "date and time"));
  expect(time(created, "F")).toBe(time(created, "full"));
  expect(time(created, "R")).toBe(time(created, "relative"));
});

test("a reply can be a card, with an optional line of text", async () => {
  const card = embed({ header: { title: "Server Information" } });
  const show = command("show", "Shows a card", (ctx) => ctx.reply("Hello", card));

  const reply = await runCommand(show, {
    author: { id: "1" },
    opt: {},
  });

  expect(reply.text).toBe("Hello");
  expect(reply.embed).toBe(card);
});

test("broken cards are rejected before they are sent", () => {
  expect(() => embed({})).toThrow("An embed needs a title, text, a picture, or fields.");
  expect(() => embed({ header: { link: "https://discord.com" } })).toThrow(
    "A title link needs a title."
  );
  expect(() => embed({ header: { title: "Hi" }, color: "notacolor" as Color })).toThrow(
    "A color must be a name from colors, or #RRGGBB."
  );
  expect(() =>
    embed({
      header: { title: "Hi" },
      fields: [{ name: "Members" } as EmbedFieldInput],
    })
  ).toThrow("A field is { name, value }.");
  expect(() => time(created, "soon" as "date")).toThrow("Unknown time style.");
  expect(() => time(new Date("nope"), "date")).toThrow("A time must be a valid date.");
});
