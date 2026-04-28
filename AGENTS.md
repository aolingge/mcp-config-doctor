# Repository Agent Instructions

## Scope

- Follow `README.md`, `package.json`, and local scripts before adding new tooling.
- Keep changes small and focused on the requested task.
- Do not commit secrets, tokens, cookies, generated credentials, browser profiles, private logs, or local machine paths.
- Preserve the CLI entry point and fixture layout unless the task explicitly changes them.

## Commands

- Install: use `npm ci` when dependencies need to be installed from `package-lock.json`.
- Check: `npm run check` (currently `node src/cli.js --config fixtures/valid.mcp.json --min-score 80`).
- Test: `npm test` (currently `node --test`).

## Verification

Run the narrowest relevant command after edits. For CLI behavior changes, prefer `npm run check` plus the focused `npm test` suite. Do not run heavy builds or publish steps unless requested.

## Git

- Preserve unrelated dirty changes.
- Do not rewrite history, delete branches, push, publish, or open PRs without explicit confirmation.
