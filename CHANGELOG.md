# Changelog

## Unreleased

- Diagnose malformed root, server, argument and environment shapes without crashing or launching invalid entries; add accurately labeled synthetic JSON fixtures.

- Added built-in default config candidates for Cline CLI and Windsurf.
- Added VS Code default/workspace, portable workspace, Cursor workspace, Copilot user and Devin legacy Cascade discovery with documented overrides and stable lookup priority.
- Added scoped JSONC support for native VS Code files and explicit `--jsonc` for custom profiles; other configs remain strict JSON.
- Preserved native Codex TOML limitations and report redaction while processing JSONC source.

## 0.1.1

- Published the npm-ready package path for `npx mcp-config-doctor`.
- Added package metadata for Node engines and public npm access.
- Added release readiness and launch notes.
- Kept the CLI zero-dependency and local-first.

## 0.1.0

- Initial MCP config preflight release.
- Added JSON, server, command, PATH, args, env, URL, secret-like value, and optional startup probe checks.
- Added text, JSON, Markdown, SARIF, and GitHub annotation output modes.
