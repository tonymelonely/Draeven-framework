# Beta smoke checklist

Run before a release or after large desk/bridge changes. Mark each item when it passes.

## Bot (core)

- [ ] `pnpm install && pnpm build && pnpm test` passes in the monorepo
- [ ] Fresh scaffold: `npm create draeven@latest /tmp/smoke-bot` (or `pnpm --filter create-draeven exec node dist/cli.js init …`)
- [ ] Set `DISCORD_TOKEN` (+ optional `DISCORD_GUILD_ID`), `pnpm start`
- [ ] Bot comes online; `/ping` replies `pong`
- [ ] A command with a button (or testbot `panel`) — click works within the collector window
- [ ] Type `stop` (or Ctrl+C) — process exits within a few seconds (no hang after `Stopping…`)

## Desk / bridge (optional)

- [ ] `DASHBOARD=embedded` with OAuth env (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DASHBOARD_OWNER_IDS`, redirect URI matching port)
- [ ] Open desk URL → Discord login → owner session works
- [ ] Overview shows bot / command count; settings save
- [ ] Split mode: bot host `DASHBOARD=bridge` + `BRIDGE_SECRET`; UI host `pnpm desk` with `BRIDGE_URL` — health and proxied status OK
- [ ] With desk open (SSE), type `stop` — still exits cleanly

## Notes

- Prefer a private test guild; do not commit `.env`.
- If slash commands are missing, confirm invite scopes and guild id sync.
- On Windows, prefer typing `stop` in the bot console (or Ctrl+C in a real TTY). A non-TTY `SIGTERM` may exit without printing `Stopping…`.

## Last automated pass

- Monorepo `pnpm test` (core / discord / bridge / create)
- Scaffold `init` and `init --with-dashboard`
- Testbot start with `DASHBOARD=off` → “ready with 17 commands”

Still manual in Discord: `/ping`, a button click, embedded OAuth desk login, and interactive `stop` with the desk SSE open.
