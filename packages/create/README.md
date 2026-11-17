# create-draeven

Scaffold a Draeven bot project.

```bash
npm create draeven@latest my-bot
cd my-bot
```

Or:

```bash
npx create-draeven init my-bot
```

Writes `draeven.config.js`, `src/main.ts` (loads `.env` via `loadEnv`), a `ping` command under `src/commands`, TypeScript config (with `@types/node`), `.gitignore`, and `.env.example`.

```bash
# copy .env.example → .env and set DISCORD_TOKEN
pnpm install
pnpm start
```

Commands are loaded from the compiled folder in `draeven.config.js` (default `./dist/commands`).
