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

Gateway events are camelCase (`memberJoin`, `messageEdit`, `voiceUpdate`, …). Pass the intents Discord requires for each.

```ts
import { Start, intentBits } from "@draeven/core";

await Start({
  token,
  intents: intentBits("guilds", "guildMembers", "guildMessages", "messageContent"),
  events: {
    ready: () => console.log("online"),
    memberJoin: (member) => console.log(member.name),
    message: (msg) => console.log(msg.content),
    messageDelete: (gone) => console.log(gone.id),
    reactionAdd: (hit) => console.log(hit.emoji.name),
    voiceUpdate: (state) => console.log(state.channelId),
  },
  // or events: "./dist/events" with named exports
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

// Forms: reply with form() first (no wait()), then:
const submitted = await collect({ ids: "ask-form", kind: "submit" });
return reply(submitted?.fields.note ?? "Timed out.");
```

## Locales

```ts
import { command, say, withLocales, user, sub } from "@draeven/core";

command(
  "greet",
  "Says hello",
  {
    who: withLocales(user("Who?"), { nl: { description: "Wie?", name: "wie" } }),
    tip: decimal("Tip amount?", { min: 0.5, max: 50 }),
  },
  async (ctx) => ctx.reply(say({ en: "Hello", nl: "Hallo" }, ctx.locale)),
  { locales: { nl: { description: "Zegt hallo" } } }
);

sub("Ban someone", async (ctx) => ctx.reply("ok"), {
  locales: { nl: { description: "Ban iemand", name: "ban" } },
});
```

`number()` is a whole number (Discord INTEGER). `decimal()` is a float (Discord NUMBER). Both accept optional `choices`.

## Hot-reload

Keep Discord connected while commands (and optional event modules) change. Use `pnpm dev` (tsc watch + bot), or run `tsc -w` yourself, with:

```ts
await Start({
  token,
  watch: true, // needs a commands folder / draeven.config
  // events: "./dist/events", // optional folder with memberJoin / memberLeave / message exports
});
```

## Simulate (tests without Discord)

```ts
import { command, simulate } from "@draeven/core";

const ping = command("ping", "Checks the bot", (ctx) => ctx.reply("pong"));
const reply = await simulate(ping, { author: { id: "1" } });
```

## Gates, defer, and actions

```ts
command(
  "ban",
  "Ban a member",
  { who: user("Who?").required() },
  async (ctx) => {
    await ctx.ban(ctx.who, { reason: "Nope" });
    return ctx.reply("Banned.");
  },
  {
    need: "BanMembers",
    defer: true, // or rely on autoDefer (default ~2s)
    // ownerOnly: true,
    // when: (ctx) => Boolean(ctx.getGuild()),
  }
);
```

`Start({ autoDefer: false })` turns off the 2s safety defer. Cooldown / gate / failure messages use the caller's locale.

## One process

`Start()` keeps one bot per project by default. If another instance is already running, a TTY prompt asks whether to stop it:

```text
[Draeven] Another bot is already running (pid 12345). Stop it and continue? [y/N]
```

```ts
await Start({
  token,
  alone: "ask", // default — or true to replace quietly, false to skip
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

## Dashboard / desk

Optional ops UI via [`@draeven/bridge`](https://www.npmjs.com/package/@draeven/bridge). Modes (`DASHBOARD`):

| Mode | Meaning |
|------|---------|
| `embedded` (default) | Bot + desk UI in one process |
| `off` | Bot only |
| `bridge` | Bot + API on the bot host |
| `desk` | UI-only process (`pnpm desk`) talking to `BRIDGE_URL` |

```bash
npm create draeven@latest my-bot -- --with-dashboard
```

Set OAuth (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DASHBOARD_OWNER_IDS`) for the UI. Split hosts need `BRIDGE_SECRET` (≥ 12 chars) and `BRIDGE_URL`. Optional hardening: `BRIDGE_ALLOW_IPS`, `BRIDGE_TLS_CERT` / `BRIDGE_TLS_KEY`. Full env reference: [packages/bridge/README.md](packages/bridge/README.md).

```ts
import { startDashboard, readDashboardMode } from "@draeven/bridge";

const mode = readDashboardMode();
if (mode === "embedded") {
  const desk = await startDashboard({ bot, root, botToken: token, kind: "embedded" });
  console.log(desk.url);
}
```

## Packages

| Package | Role |
|---------|------|
| `@draeven/core` | Commands, options, embeds, pieces, Start |
| `@draeven/discord` | Gateway + REST client |
| `@draeven/bridge` | Embedded desk, remote bridge API, desk UI |
| `create-draeven` | Project scaffold (`draeven init`, `--with-dashboard`) |

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
pnpm --filter @draeven/bridge publish --access public
pnpm --filter create-draeven publish --access public
```
