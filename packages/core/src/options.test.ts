/* Draeven Core: tests for slash-command options */

import { expect, expectTypeOf, test } from "vitest";
import {
  channel,
  choice,
  command,
  file,
  number,
  role,
  runCommand,
  text,
  user,
} from "./command.js";
import type { Channel, File, Role, User } from "./lookup.js";

const tony: User = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

const room: Channel = { id: "11", name: "general" };
const member: Role = { id: "12", name: "member" };
const photo: File = {
  id: "13",
  name: "shot.png",
  url: "https://cdn.discordapp.com/attachments/1/13/shot.png",
};

test("every option kind stores cleanly and types the context", () => {
  const ask = command(
    "ask",
    "Tries every option kind",
    {
      who: user("Who?"),
      saying: text("What should I say?", { min: 1, max: 100 }).required(),
      times: number("How many times?", { min: 1, max: 5 }),
      mood: choice("Mood?", [
        "happy",
        { label: "Calm", value: "calm", note: "Quiet" },
        "loud",
      ]).required(),
      where: channel("Where?", { kinds: ["text"] }),
      team: role("Which role?"),
    },
    (ctx) => {
      expectTypeOf(ctx.who).toEqualTypeOf<User | undefined>();
      expectTypeOf(ctx.saying).toEqualTypeOf<string>();
      expectTypeOf(ctx.times).toEqualTypeOf<number | undefined>();
      expectTypeOf(ctx.mood).toEqualTypeOf<string>();
      expectTypeOf(ctx.where).toEqualTypeOf<Channel | undefined>();
      expectTypeOf(ctx.team).toEqualTypeOf<Role | undefined>();
      return ctx.reply(ctx.saying);
    }
  );

  expect(ask.options).toEqual({
    who: { kind: "user", question: "Who?", required: false },
    saying: {
      kind: "text",
      question: "What should I say?",
      required: true,
      min: 1,
      max: 100,
    },
    times: {
      kind: "number",
      question: "How many times?",
      required: false,
      min: 1,
      max: 5,
    },
    mood: {
      kind: "choice",
      question: "Mood?",
      required: true,
      choices: [
        { label: "happy", value: "happy" },
        { label: "Calm", value: "calm", note: "Quiet" },
        { label: "loud", value: "loud" },
      ],
    },
    where: {
      kind: "channel",
      question: "Where?",
      required: false,
      kinds: ["text"],
    },
    team: { kind: "role", question: "Which role?", required: false },
  });
});

test("user channel and role options are already resolved objects", async () => {
  const ask = command(
    "place",
    "Names a place and a role",
    {
      where: channel("Where?").required(),
      team: role("Which role?").required(),
    },
    async (ctx) => {
      const { where, team, reply } = ctx;
      return reply(`${where.name}:${team.name}`);
    }
  );

  const reply = await runCommand(ask, {
    author: { id: tony.id },
    users: [tony],
    channels: [room],
    knownRoles: [member],
    opt: {
      where: room,
      team: member,
    },
  });

  expect(reply.text).toBe("general:member");
});

test("optional text and number may be empty", async () => {
  const note = command(
    "note",
    "Writes a short note",
    {
      saying: text("What?"),
      times: number("How many?"),
    },
    async (ctx) => {
      const { saying, times, reply } = ctx;
      return reply(`${saying ?? "nothing"} x ${times ?? 0}`);
    }
  );

  const reply = await runCommand(note, {
    author: { id: tony.id },
    users: [tony],
    opt: { saying: undefined, times: undefined },
  });

  expect(reply.text).toBe("nothing x 0");
});

test("file options arrive as File objects", async () => {
  const upload = command(
    "upload",
    "Names a file",
    { image: file("Which image?").required() },
    async (ctx) => {
      const { image, reply } = ctx;
      return reply(image.name);
    }
  );

  expect(upload.options.image).toEqual({
    kind: "file",
    question: "Which image?",
    required: true,
  });

  const reply = await runCommand(upload, {
    author: { id: tony.id },
    users: [tony],
    files: [photo],
    opt: { image: photo },
  });

  expect(reply.text).toBe("shot.png");
});

test("text suggest is stored on the option", () => {
  const ask = command(
    "tag",
    "Picks a tag",
    {
      tag: text("Which tag?").suggest(async ({ typed }) =>
        ["alpha", "bravo"].filter((item) => item.startsWith(typed))
      ),
    },
    async (ctx) => {
      const { tag, reply } = ctx;
      return reply(tag ?? "none");
    }
  );

  expect(ask.options.tag.kind).toBe("text");
  if (ask.options.tag.kind === "text") {
    expect(typeof ask.options.tag.suggest).toBe("function");
  }
});

test("bad option shapes are rejected", () => {
  expect(() => text("")).toThrow("text option question");
  expect(() => number("How many?", { min: 5, max: 1 })).toThrow(
    "min cannot be greater than max"
  );
  expect(() => choice("Pick?", [])).toThrow("1-25 choices");
  expect(() => channel("Where?", { kinds: [] })).toThrow("at least one channel kind");
});
