# @draeven/discord

Draeven's Discord client: gateway session, REST, interactions, and intents. Built with `ws` + `fetch` — not discord.js.

You normally use this through [`@draeven/core`](https://www.npmjs.com/package/@draeven/core). Import it directly only when you need low-level gateway or REST helpers.

```bash
npm install @draeven/discord
```

```ts
import { DiscordClient, intents, intentsFor } from "@draeven/discord";

const client = await DiscordClient.connect({
  token: process.env.DISCORD_TOKEN!,
  // Prefer intentsFor("memberJoin", "message") when you wire BotEvents
  intents: intents.guilds | intentsFor("memberJoin"),
});
```
