# Launch Notes

Primary audience: developers debugging Claude Desktop, Cursor, Codex, Cline, Windsurf, or other MCP client configuration.

Positioning:

> Diagnose MCP config files before your AI client fails with a vague connection error.

Short post:

```text
MCP config errors are painful because clients often fail with vague connection messages.

mcp-config-doctor checks JSON shape, server entries, command visibility, env mistakes, URLs, secret-like values, and optional startup probes locally.

npx mcp-config-doctor --config claude_desktop_config.json

https://github.com/aolingge/mcp-config-doctor
```

Safety wording:

- It is a config doctor, not a proof that an MCP server is safe.
- It runs locally and does not upload config files.
- `--start` is explicit opt-in because it launches local server commands.
