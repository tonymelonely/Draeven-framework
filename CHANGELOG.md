# Changelog

All notable changes to Draeven packages are documented here.

## Unreleased

### Added

- MIT `LICENSE` files for the monorepo and publishable packages
- GitHub Actions CI (build, typecheck, test on Node 20 and 22)
- `@draeven/bridge` documentation and unit tests
- Golden-path + known-limits docs, smoke checklist, DX issue templates

### Fixed

- `@draeven/discord` README now shows `new DiscordClient` + `start()` (not a non-existent `connect`)
- Console `stop` no longer hangs on open SSE / keep-alive sockets in the bridge desk

## 0.1.10 — 2026-11-22

### create-draeven

- Pin `@draeven/core` to `^0.1.9`
- `--with-dashboard` scaffold (`@draeven/bridge`, desk entry, richer `.env.example`)
- Generated project `README.md` and `use()` letter-button sample in the events folder

## 0.1.9 — 2026-11-22

### @draeven/core

- `use()` durable press/submit handlers loaded from the events folder (survive restarts)
- `intentsFor` / `intentBits` helpers for gateway intents
- Presence helpers (`setPresence`), sync state, and `onSync`
- Message helpers on `ctx` (`pin` / `react` / `edit` / `delete`) and continued command / components / locale polish for beta

### create-draeven

- Scaffold aligned with current core APIs, including events-folder `use()` loading
## 0.1.5 — 2026-03

### @draeven/discord

- Gateway session, REST, intents, and interaction parsing used by core

## 0.1.0 — 2026-03

### @draeven/bridge

- Embedded desk, remote bridge API, and desk UI modes
- OAuth owners, audit log, IP allowlist, optional TLS
- Live presence, guild picker, browse/actions, sync status in the UI
