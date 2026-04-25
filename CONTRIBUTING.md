# Contributing

Thanks for helping improve MCP setup diagnostics.

## Good First PRs

- Add a default config path for a client.
- Add a fixture that captures a real setup mistake.
- Improve a confusing check message.
- Add docs for Claude Desktop, Cursor, Codex, Cline, or Windsurf.

## Local Workflow

```bash
npm install
npm test
npm run check
```

## Pull Request Rules

- Keep changes small and focused.
- Do not commit real tokens, API keys, cookies, or private config.
- Add or update a fixture when changing diagnosis behavior.
- Keep README links working in both English and Chinese docs.

## Report Style

When opening an issue, include:

- Client name and OS.
- A redacted config snippet.
- `mcp-config-doctor --json` output with secrets removed.
- What you expected the client to do.

