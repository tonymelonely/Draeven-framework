# @draeven/bridge

Optional bot↔dashboard bridge for Draeven: embedded desk UI, remote API (`bridge`), or UI-only desk that talks to a bot host.

```bash
npm install @draeven/bridge
```

Requires Node 20+. Pair with [`@draeven/core`](https://www.npmjs.com/package/@draeven/core).

## Modes (`DASHBOARD`)

| Value | Process | Role |
|-------|---------|------|
| `embedded` (default) | bot process | Bot + OAuth desk UI together |
| `off` | bot process | Bot only |
| `bridge` | bot process | Hardened API only (no UI) |
| `desk` | separate process | UI only; proxies to `BRIDGE_URL` |

```ts
import { Start } from "@draeven/core";
import { readDashboardMode, readBridgeSecret, startDashboard } from "@draeven/bridge";

const bot = await Start({ token });
const mode = readDashboardMode();

if (mode === "embedded") {
  const desk = await startDashboard({ bot, root, botToken: token, kind: "embedded" });
  console.log(desk.url);
} else if (mode === "bridge") {
  const api = await startDashboard({
    bot,
    root,
    botToken: token,
    kind: "bridge",
    bridgeSecret: readBridgeSecret(),
  });
  console.log(api.url);
}
```

Desk-only process:

```ts
import { readBridgeSecret, readBridgeUrl, startDesk } from "@draeven/bridge";

const desk = await startDesk({
  root,
  bridgeUrl: readBridgeUrl(),
  bridgeSecret: readBridgeSecret(),
});
```

Scaffold with dashboard wiring:

```bash
npm create draeven@latest my-bot -- --with-dashboard
```

## Environment

```bash
DISCORD_TOKEN=
# DISCORD_GUILD_ID=

# embedded | off | bridge | desk
DASHBOARD=embedded

# OAuth for embedded / desk UI (Discord Developer Portal → OAuth2)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DASHBOARD_OWNER_IDS=          # comma-separated Discord user ids
# DASHBOARD_PORT=3847
# DASHBOARD_HOST=127.0.0.1
# DASHBOARD_SESSION_SECRET=
# DISCORD_REDIRECT_URI=http://127.0.0.1:3847/auth/callback

# Split hosts
# BRIDGE_SECRET=change-me-to-a-long-random-string   # 12+ chars
# BRIDGE_PORT=3848
# BRIDGE_HOST=0.0.0.0
# BRIDGE_URL=http://127.0.0.1:3848
# BRIDGE_ALLOW_IPS=127.0.0.1,::1
# BRIDGE_TLS_CERT=./certs/fullchain.pem
# BRIDGE_TLS_KEY=./certs/privkey.pem
```

Redirect URI must match the port you actually listen on (`DASHBOARD_PORT`, default `3847`).

## Security notes

- **Owners:** only `DASHBOARD_OWNER_IDS` can use the desk after Discord OAuth.
- **Bridge secret:** Bearer token for API calls between desk and bridge (`BRIDGE_SECRET`, ≥ 12 characters).
- **IP allowlist:** optional `BRIDGE_ALLOW_IPS` (also honors `X-Forwarded-For` when present).
- **TLS:** set `BRIDGE_TLS_CERT` + `BRIDGE_TLS_KEY` for HTTPS on bridge or desk.
- **Audit:** actions append to `.draeven/audit.jsonl` under the project root.

The desk is an ops console for your bot — not a multi-tenant host.

## API surface (bridge)

Unauthenticated: `GET /api/health`.

Authenticated (Bearer / OAuth session): status, sync, commands, guilds, members, channels, roles, logs, audit, settings, SSE feed, and moderation/message actions (`send`, `kick`, `ban`, `timeout`, `pin`, `react`, `purge`).
