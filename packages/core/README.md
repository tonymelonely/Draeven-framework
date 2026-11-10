# @draeven/core

Developer API for Draeven bots: commands, options, embeds, pieces, polls, Components V2, and `Start`.

```bash
npm install @draeven/core
```

```ts
import { Start, command, user } from "@draeven/core";

export const greet = command(
  "greet",
  "Greets someone",
  { who: user("Who?") },
  async (ctx) => {
    const { who, author, getUser, reply } = ctx;
    return reply(`Hello ${(who ?? getUser(author)).name}`);
  },
  { cooldown: 3 }
);

await Start({ token: process.env.DISCORD_TOKEN! });
```

See the [Draeven README](https://github.com/tonymelonely/Draeven-framework) for presence, private replies, wait/edit, events, and layout examples.
