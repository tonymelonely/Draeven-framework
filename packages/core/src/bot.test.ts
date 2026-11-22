/* Draeven Core: tests for answering a command from Discord */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { ApplicationCommandBody, IncomingCommand, IncomingUse, InteractionReply } from "@draeven/discord";
import { answerCommand, startBot, type BotConnection } from "./bot.js";
import {
  channel,
  choice,
  command,
  number,
  role,
  text,
  user,
} from "./command.js";
import { breakline, embed } from "./embed.js";
import { button, people, row } from "./pieces.js";
import { formatDate, Netherlands } from "./format-date.js";
import { loadCommands } from "./load-commands.js";
import { userinfo } from "./samples/userinfo.js";
import { use } from "./use.js";

const epoch = 1_420_070_400_000n;

function snowflake(date: Date): string {
  return ((BigInt(date.getTime()) - epoch) << 22n).toString();
}

const tonyAt = new Date(Date.UTC(2020, 0, 2));
const tonyId = snowflake(tonyAt);

test("startBot registers userinfo and answers the caller", async () => {
  const fake = fakeConnection();
  const running = await startBot(fake.connection, {
    commands: [userinfo],
    guildId: "42",
  });

  expect(running.commands).toEqual([userinfo]);
  expect(fake.guildId).toBe("42");
  expect(fake.registered).toEqual([
    {
      type: 1,
      name: "userinfo",
      description: "Shows who someone is",
      options: [
        {
          type: 6,
          name: "user",
          description: "About whom?",
          required: false,
        },
      ],
    },
  ]);

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "userinfo",
    author: { id: tonyId, name: "Tony", bot: false },
    options: [],
    users: [{ id: tonyId, name: "Tony", bot: false }],
    channels: [],
    roles: [],
    files: [],
  });

  expect(fake.replies).toEqual([
    {
      content: [
        "Name: Tony",
        `Id: ${tonyId}`,
        `Created: ${formatDate(tonyAt, Netherlands)}`,
        "Kind: human",
      ].join("\n"),
    },
  ]);

  await running.stop();
  expect(fake.stopped).toBe(true);
});

test("startBot registers every option kind", async () => {
  const ask = command(
    "ask",
    "Tries every option kind",
    {
      who: user("Who?"),
      saying: text("What?", { min: 1, max: 40 }).required(),
      times: number("How many?", { min: 1, max: 5 }),
      mood: choice("Mood?", ["happy", "calm"]).required(),
      where: channel("Where?", { kinds: ["text", "voice"] }),
      team: role("Which role?"),
    },
    async (ctx) => {
      const { saying, reply } = ctx;
      return reply(saying);
    }
  );

  const fake = fakeConnection();
  await startBot(fake.connection, { commands: [ask] });

  expect(fake.registered).toEqual([
    {
      type: 1,
      name: "ask",
      description: "Tries every option kind",
      options: [
        {
          type: 3,
          name: "saying",
          description: "What?",
          required: true,
          min_length: 1,
          max_length: 40,
        },
        {
          type: 3,
          name: "mood",
          description: "Mood?",
          required: true,
          choices: [
            { name: "happy", value: "happy" },
            { name: "calm", value: "calm" },
          ],
        },
        { type: 6, name: "who", description: "Who?", required: false },
        {
          type: 4,
          name: "times",
          description: "How many?",
          required: false,
          min_value: 1,
          max_value: 5,
        },
        {
          type: 7,
          name: "where",
          description: "Where?",
          required: false,
          channel_types: [0, 2],
        },
        { type: 8, name: "team", description: "Which role?", required: false },
      ],
    },
  ]);
});

test("answerCommand fills every option kind", async () => {
  const ask = command(
    "ask",
    "Tries every option kind",
    {
      who: user("Who?"),
      saying: text("What?").required(),
      times: number("How many?"),
      mood: choice("Mood?", ["happy", "calm"]).required(),
      where: channel("Where?"),
      team: role("Which role?"),
    },
    async (ctx) => {
      const { who, saying, times, mood, where, team, author, getUser, reply } = ctx;
      const person = who ?? getUser(author);
      return reply(
        `${person.name}|${saying}|${times ?? 0}|${mood}|${where?.name ?? "here"}|${team?.name ?? "nobody"}`
      );
    }
  );

  const reply = await answerCommand(
    [ask],
    {
      id: "interaction",
      token: "token",
      name: "ask",
      author: { id: tonyId, name: "Tony", bot: false },
      options: [
        { name: "who", kind: "user", userId: tonyId },
        { name: "saying", kind: "string", value: "hello" },
        { name: "times", kind: "integer", value: 2 },
        { name: "mood", kind: "string", value: "calm" },
        { name: "where", kind: "channel", channelId: "22" },
        { name: "team", kind: "role", roleId: "33" },
      ],
      users: [{ id: tonyId, name: "Tony", bot: false }],
      channels: [{ id: "22", name: "general" }],
      roles: [{ id: "33", name: "member" }],
      files: [],
    },
    { id: "9", name: "Bot", bot: true }
  );

  expect(reply?.text).toBe("Tony|hello|2|calm|general|member");
});

test("answerCommand uses the selected user", async () => {
  const draevenAt = new Date(Date.UTC(2024, 4, 6));
  const draevenId = snowflake(draevenAt);

  const reply = await answerCommand(
    [userinfo],
    {
      id: "interaction",
      token: "token",
      name: "userinfo",
      author: { id: tonyId, name: "Tony", bot: false },
      options: [{ name: "user", kind: "user", userId: draevenId }],
      channels: [],
      roles: [],
      files: [],
      users: [
        { id: tonyId, name: "Tony", bot: false },
        { id: draevenId, name: "Draeven", bot: true },
      ],
    },
    { id: "9", name: "Bot", bot: true }
  );

  expect(reply?.text).toBe(
    [
      "Name: Draeven",
      `Id: ${draevenId}`,
      `Created: ${formatDate(draevenAt, Netherlands)}`,
      "Kind: bot",
    ].join("\n")
  );
});

test("a card reply is sent as one embed", async () => {
  const show = command("show", "Shows a card", (ctx) =>
    ctx.reply(
      embed({
        header: {
          title: "Server information",
          image: "https://cdn.discordapp.com/embed/avatars/1.png",
        },
        color: "blurple",
        fields: [
          { name: "Members", value: 2 },
          { name: "Channels", value: 1 },
          breakline,
          { name: "Boosts", value: 4 },
        ],
      })
    )
  );

  const fake = fakeConnection();
  const running = await startBot(fake.connection, { commands: [show] });

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "show",
    author: { id: tonyId, name: "Tony", bot: false },
    options: [],
    users: [{ id: tonyId, name: "Tony", bot: false }],
    channels: [],
    roles: [],
    files: [],
  });

  expect(fake.replies).toEqual([
    {
      embeds: [
        {
          title: "Server information",
          color: 0x5865f2,
          thumbnail: { url: "https://cdn.discordapp.com/embed/avatars/1.png" },
          fields: [
            { name: "Members", value: "2", inline: true },
            { name: "Channels", value: "1", inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "Boosts", value: "4", inline: true },
          ],
        },
      ],
    },
  ]);

  await running.stop();
});

test("watch reloads commands from a folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-watch-"));
  const mark = `
    const mark = Symbol.for("draeven.command");
  `;

  await writeFile(
    join(root, "ping.js"),
    `
      ${mark}
      const ping = { kind: "slash", name: "ping", description: "Ping", options: {}, subs: {}, run() { return { text: "pong" }; } };
      Object.defineProperty(ping, mark, { value: true });
      export { ping };
    `
  );

  const fake = fakeConnection();
  const running = await startBot(fake.connection, {
    commands: await loadCommands(root),
    commandsFolder: root,
    watch: true,
  });

  expect(running.commands.map((entry) => entry.name)).toEqual(["ping"]);

  await writeFile(
    join(root, "hello.js"),
    `
      ${mark}
      const hello = { kind: "slash", name: "hello", description: "Hello", options: {}, subs: {}, run() { return { text: "hi" }; } };
      Object.defineProperty(hello, mark, { value: true });
      export { hello };
    `
  );

  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(running.commands.map((entry) => entry.name).sort()).toEqual(["hello", "ping"]);
  expect(fake.registered?.map((entry) => entry.name).sort()).toEqual(["hello", "ping"]);
  await running.stop();
});

test("a button is sent and a press answers", async () => {
  const yes = button({
    id: "yes",
    label: "Yes",
    color: "green",
    press: async (ctx) => {
      const { reply } = ctx;
      return reply("Yes.");
    },
  });
  const ask = command("ask", "Asks", async (ctx) => {
    const { reply } = ctx;
    return reply({ text: "Go", rows: [row(yes)] });
  });
  const fake = fakeConnection();
  const running = await startBot(fake.connection, { commands: [ask] });

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "ask",
    author: { id: tonyId, name: "Tony", bot: false },
    options: [],
    users: [{ id: tonyId, name: "Tony", bot: false }],
    channels: [],
    roles: [],
    files: [],
  });

  expect(fake.replies[0]).toEqual({
    content: "Go",
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 3, label: "Yes", custom_id: "yes" }],
      },
    ],
  });

  await fake.emitUse({
    id: "press",
    token: "press-token",
    customId: "yes",
    author: { id: tonyId, name: "Tony", bot: false },
    kind: "press",
    users: [],
    values: [],
    fields: {},
  });

  expect(fake.replies[1]).toEqual({ content: "Yes." });

  await fake.emitUse({
    id: "other",
    token: "other-token",
    customId: "missing",
    author: { id: tonyId, name: "Tony", bot: false },
    kind: "press",
    users: [],
    values: [],
    fields: {},
  });

  expect(fake.replies[2]).toEqual({ content: "Received." });
  await running.stop();
});

test("use() from Start answers presses without a remembered button press", async () => {
  const letter = use({
    ids: "hangman_*",
    run: async (ctx) => ctx.reply(`Letter ${ctx.id.slice("hangman_".length)}`),
  });
  const board = command("board", "Posts letter buttons", async (ctx) =>
    ctx.reply({
      text: "Pick",
      rows: [row(button({ id: "hangman_A", label: "A" }), button({ id: "hangman_B", label: "B" }))],
    })
  );
  const fake = fakeConnection();
  const running = await startBot(fake.connection, { commands: [board], uses: [letter] });

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "board",
    author: { id: tonyId, name: "Tony", bot: false },
    options: [],
    users: [{ id: tonyId, name: "Tony", bot: false }],
    channels: [],
    roles: [],
    files: [],
  });

  await fake.emitUse({
    id: "press",
    token: "press-token",
    customId: "hangman_A",
    author: { id: tonyId, name: "Tony", bot: false },
    kind: "press",
    users: [],
    values: [],
    fields: {},
    messageId: "msg-9",
  });

  expect(fake.replies[1]).toEqual({ content: "Letter A" });
  await running.stop();
});

test("a card press replaces the message and a menu can read the chosen user", async () => {
  const show = command("show", "Shows a card", async (ctx) => {
    const { reply } = ctx;
    return reply(
      embed({
        header: { title: "Tony" },
        rows: [
          row(
            button({
              id: "server",
              label: "Server",
              press: async (press) => {
                const { reply: next } = press;
                return next(
                  embed({
                    header: { title: "Server" },
                    rows: [row(button({ id: "user", label: "User" }))],
                  })
                );
              },
            })
          ),
          row(
            people({
              id: "who",
              placeholder: "Another user",
              press: async (press) => {
                const { reply: next, values, getUser } = press;
                return next(getUser({ id: values[0] ?? "" }).name);
              },
            })
          ),
        ],
      })
    );
  });
  const fake = fakeConnection();
  const running = await startBot(fake.connection, { commands: [show] });
  const caller = { id: tonyId, name: "Tony", bot: false };

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "show",
    author: caller,
    options: [],
    users: [caller],
    channels: [],
    roles: [],
    files: [],
  });

  expect(fake.replies[0]?.update).toBeUndefined();
  expect(fake.replies[0]?.embeds?.[0]?.title).toBe("Tony");
  expect(fake.replies[0]?.components).toHaveLength(2);

  await fake.emitUse({
    id: "press",
    token: "press-token",
    customId: "server",
    kind: "press",
    author: caller,
    users: [caller],
    values: [],
    fields: {},
  });

  expect(fake.replies[1]?.update).toBe(true);
  expect(fake.replies[1]?.embeds?.[0]?.title).toBe("Server");

  await fake.emitUse({
    id: "pick",
    token: "pick-token",
    customId: "who",
    kind: "press",
    author: caller,
    users: [{ id: "8", name: "Draeven", bot: true }],
    values: ["8"],
    fields: {},
  });

  expect(fake.replies[2]).toEqual({ content: "Draeven" });
  await running.stop();
});

test("a transcript is sent after Discord is told to wait", async () => {
  const save = command("transcript", "Saves the channel", async (ctx) => {
    const { transcript, reply } = ctx;
    return reply(await transcript());
  });
  const fake = fakeConnection();
  const running = await startBot(fake.connection, { commands: [save] });

  await fake.emit({
    id: "interaction",
    token: "token",
    name: "transcript",
    author: { id: tonyId, name: "Tony", bot: false },
    options: [],
    users: [{ id: tonyId, name: "Tony", bot: false }],
    channels: [],
    roles: [],
    files: [],
    channelId: "11",
  });

  const html = new TextDecoder().decode(fake.replies[0]?.files?.[0]?.bytes ?? new Uint8Array());
  expect(fake.replies[0]?.content).toBe("1 message from #general.");
  expect(fake.replies[0]?.files?.[0]?.filename).toBe("general.html");
  expect(html).toContain("Tony");
  expect(html).toContain("&lt;b&gt;there&lt;/b&gt;");
  await running.stop();
});

function fakeConnection(): {
  connection: BotConnection;
  replies: InteractionReply[];
  registered?: readonly ApplicationCommandBody[];
  guildId?: string;
  stopped: boolean;
  emit(command: IncomingCommand): Promise<void>;
  emitUse(use: IncomingUse): Promise<void>;
} {
  const replies: InteractionReply[] = [];
  let registered: readonly ApplicationCommandBody[] | undefined;
  let guildId: string | undefined;
  let stopped = false;
  let handler: ((command: IncomingCommand) => void | Promise<void>) | undefined;
  let useHandler: ((use: IncomingUse) => void | Promise<void>) | undefined;

  return {
    replies,
    get registered() {
      return registered;
    },
    get guildId() {
      return guildId;
    },
    get stopped() {
      return stopped;
    },
    emit(command) {
      return Promise.resolve(handler?.(command));
    },
    emitUse(use) {
      return Promise.resolve(useHandler?.(use));
    },
    connection: {
      async start() {},
      async stop() {
        stopped = true;
      },
      readyUser() {
        return { id: "9", name: "Bot", bot: true, applicationId: "9" };
      },
      async readGuild() {
        return undefined;
      },
      async readRoles() {
        return [];
      },
      async readUser() {
        return undefined;
      },
      async defer() {},
      async editReply(_applicationId, _token, reply) {
        replies.push(reply);
      },
      async readHistory() {
        return {
          channel: { id: "11", name: "general", kind: "text", guildId: "42" },
          messages: [
            {
              id: "1",
              type: 0,
              content: "hello <b>there</b>",
              timestamp: "2020-01-02T00:00:00.000Z",
              author: { id: tonyId, username: "tony", global_name: "Tony" },
            },
          ],
          truncated: false,
        };
      },
      async registerCommands(commands, id) {
        registered = commands;
        guildId = id;
      },
      onCommand(next) {
        handler = next;
        return () => {
          handler = undefined;
        };
      },
      onUse(next) {
        useHandler = next;
        return () => {
          useHandler = undefined;
        };
      },
      async replyTo(_interactionId, _token, reply) {
        replies.push(reply);
      },
    },
  };
}
