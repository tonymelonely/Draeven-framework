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

With optional desk / bridge wiring:

```bash
npx create-draeven init my-bot --with-dashboard
```

Writes `draeven.config.js`, `src/main.ts` (loads `.env` via `loadEnv`), a `ping` command under `src/commands`, TypeScript config (with `@types/node`), `.gitignore`, `.env.example`, and a short `README.md`.

`--with-dashboard` also adds `@draeven/bridge`, richer `.env.example` (OAuth / bridge / desk), `src/desk-main.ts`, and `pnpm desk`.

```bash
# copy .env.example → .env and set DISCORD_TOKEN
pnpm install
pnpm start
```

Commands are loaded from the compiled folder in `draeven.config.js` (default `./dist/commands`).
