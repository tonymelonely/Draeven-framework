# Contributing to Draeven

Thanks for helping shape the beta. Prefer small, focused changes and DX feedback over large speculative APIs.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Node ≥ 20. Packages live under `packages/` (`core`, `discord`, `bridge`, `create`).

## Feedback we want first

Before proposing big features, tell us what hurt in the first hour:

- Confusing errors or missing guidance
- Intents / events that were hard to wire
- OAuth / desk setup friction
- Scaffold gaps (`create-draeven`)

Use the **DX feedback** issue template, or open a normal bug report for hard failures.

## Pull requests

1. Branch from `master`
2. Keep CI green (build, typecheck, test)
3. Update docs when behavior or public APIs change
4. Do not commit secrets or `.env` files

## Releases

Maintainers publish with `pnpm --filter <pkg> publish --access public` after version bumps and `CHANGELOG.md` notes.
