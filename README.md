# Draeven

A Discord framework built from scratch — no discord.js. Commands stay declarative; handlers get one `ctx`.

## Getting started

```bash
npm create draeven@latest my-bot
cd my-bot
```

Set `DISCORD_TOKEN` (and optionally `DISCORD_GUILD_ID` for guild-only command sync), then:

```bash
pnpm install
pnpm start
```

`draeven init` writes `draeven.config.js`, a `ping` command, and a small `Start` entry.

## Write a command

```ts
import { command, text, user } from "@draeven/core";

export const greet = command(
  "greet",
  "Greets someone",
  {
    who: user("Who?"),
    note: text("Extra note?"),
  },
  async (ctx) => {
    const { who, note, author, getUser, reply } = ctx;
    const person = who ?? getUser(author);
    return reply(`Hello ${person.name}${note ? ` — ${note}` : ""}`);
  }
);
```

## Presence

```ts
await Start({
  token,
  presence: {
    status: "online",
    activity: { kind: "watching", text: "slash commands" },
  },
});
```

## Polls and Components V2

```ts
reply(poll({ question: "Ship it?", answers: ["Yes", "Later"] }));

reply(
  layout(
    show("**Hello**"),
    divide({ line: true }),
    pack({ color: colors.blurple }, show("Inside a container"))
  )
);
```

## Private replies, followups, and send

```ts
reply("Only you see this", { private: true });
await followup("And this.");
await send(channel, "Posted in the channel");
// or after Start:
await bot.send(channelId, "Hello");
```

## Wait, edit, remove

```ts
await wait();
await edit("Working…");
return reply("Done.");
// await remove();
```

## Events and intents

```ts
import { Start, intents } from "@draeven/core";

await Start({
  token,
  intents: intents.guilds | intents.guildMembers,
  events: {
    memberJoin: (member) => console.log(member.name),
  },
});
```

## Mentionable

```ts
target: mentionable("Who or which role?").required()
// `"bot" in target` → user, otherwise role
```

## Cooldowns

```ts
command("ping", "Checks whether the bot is alive", async (ctx) => ctx.reply("pong"), {
  cooldown: 5,
});

// or:
{ cooldown: { seconds: 10, scope: "guild", private: true } }
```

Scope is `user` (default), `guild`, or `channel`. On cooldown the bot replies privately with the remaining wait.

## Collectors

```ts
await wait();
await edit({
  text: "Pick one.",
  rows: [row(button({ id: "yes", label: "Yes" }), button({ id: "no", label: "No" }))],
});
const pick = await collect({ ids: ["yes", "no"], seconds: 30 });
if (!pick) return reply("Timed out.");
return reply(`You chose ${pick.id}`);
```

## Locales

```ts
import { command, say } from "@draeven/core";

command(
  "ping",
  "Checks whether the bot is alive",
  async (ctx) => ctx.reply(say({ en: "pong", nl: "pong" }, ctx.locale)),
  {
    locales: {
      nl: { description: "Checkt of de bot leeft" },
    },
  }
);
```

## Hot-reload

Keep Discord connected while commands (and optional event modules) change. Run `tsc -w` so `dist/` updates, then:

```ts
await Start({
  token,
  watch: true, // needs a commands folder / draeven.config
  // events: "./dist/events", // optional folder with memberJoin / memberLeave / message exports
});
```

## Guard

Optional. Import only if you want Draeven to catch errors and keep the process alive:

```ts
import { Start, guard } from "@draeven/core";

await Start({
  token,
  watch: true,
  guard: guard({
    via: ["console", "channel"], // or "all" / ["console", "file"]
    of: "all", // or ["commands", "events", "process"]
    channel: process.env.LOG_CHANNEL_ID,
    // file: "./logs/draeven.log",
    uptime: true,
  }),
});
```

## Packages

| Package | Role |
|---------|------|
| `@draeven/core` | Commands, options, embeds, pieces, Start |
| `@draeven/discord` | Gateway + REST client |
| `create-draeven` | Project scaffold (`draeven init`) |

## Local monorepo

```bash
pnpm install
pnpm -r build
pnpm --filter @draeven/core test
```

## Publish

```bash
npm login
pnpm -r build
pnpm --filter @draeven/discord publish --access public
pnpm --filter @draeven/core publish --access public
pnpm --filter create-draeven publish --access public
```
