# Changelog

All notable changes to Draeven packages are documented here.

## Unreleased

### Added

- MIT `LICENSE` files for the monorepo and publishable packages
- GitHub Actions CI (build, typecheck, test on Node 20 and 22)
- `@draeven/bridge` documentation and unit tests
- `create-draeven init --with-dashboard` scaffold option

### Fixed

- `@draeven/discord` README now shows `new DiscordClient` + `start()` (not a non-existent `connect`)
- Console `stop` no longer hangs on open SSE / keep-alive sockets in the bridge desk

## 0.1.9 — 2026-03

### @draeven/core

- Presence helpers (`setPresence`), sync state, and `onSync`
- Continued command / components / locale polish for beta

### create-draeven

- Scaffold aligned with current core APIs

## 0.1.5 — 2026-03

### @draeven/discord

- Gateway session, REST, intents, and interaction parsing used by core

## 0.1.0 — 2026-03

### @draeven/bridge

- Embedded desk, remote bridge API, and desk UI modes
- OAuth owners, audit log, IP allowlist, optional TLS
- Live presence, guild picker, browse/actions, sync status in the UI
