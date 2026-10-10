# MCP Config Paths

Auto-discovery chooses the first existing candidate in the order below. Existing home-client priority is retained; use `--config FILE` to select another client explicitly. No server starts unless `--start` is supplied. For startup probes, prefer an explicit config path.

| Order | Client / scope | Candidate |
| --- | --- | --- |
| 1 | Claude Desktop | Windows: `%APPDATA%/Claude/claude_desktop_config.json`; macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`; Linux: `$XDG_CONFIG_HOME/Claude/claude_desktop_config.json` |
| 2 | Cursor global | `~/.cursor/mcp.json` |
| 3 | Cline CLI | `CLINE_MCP_SETTINGS_PATH`, otherwise `~/.cline/data/settings/cline_mcp_settings.json` |
| 4 | Windsurf compatibility | `~/.codeium/windsurf/mcp_config.json` |
| 5 | Copilot portable user | `$COPILOT_HOME/mcp-config.json`, otherwise `~/.copilot/mcp-config.json` |
| 6 | VS Code default profile | Windows: `%APPDATA%/Code/User/mcp.json`; macOS: `~/Library/Application Support/Code/User/mcp.json`; Linux: `$XDG_CONFIG_HOME/Code/User/mcp.json` |
| 7 | Portable workspace | `<cwd>/.mcp.json` |
| 8 | VS Code workspace | `<cwd>/.vscode/mcp.json` |
| 9 | Cursor workspace | `<cwd>/.cursor/mcp.json` |
| 10 | Devin legacy Cascade | Windows: `%APPDATA%/devin/mcp_config.json`; macOS/Linux: `$XDG_CONFIG_HOME/devin/mcp_config.json` |

Unset `APPDATA` falls back to `~/AppData/Roaming`; unset `XDG_CONFIG_HOME` falls back to `~/.config`. Cline/Copilot overrides replace their defaults, rather than inspecting both. Relative overrides resolve against the working directory; path contents and environment/file references inside configurations are never expanded.

[VS Code's current reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) documents Copilot, Cursor and Windsurf discovery. Its [configuration guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers) recommends portable workspace/user locations for new configurations. The old Windsurf path remains a compatibility candidate; redirected [vendor documentation](https://docs.devin.ai/desktop/cascade/mcp) now describes Devin legacy Cascade at the separate path above. It is not a claim about every current Devin agent format.

## Formats and manual profile paths

Both top-level `mcpServers` and `servers` objects are supported. Recognized `.vscode/mcp.json`, standard `Code/User[/profiles/<id>]/mcp.json` (including Code - Insiders), and `.jsonc` files allow JSON comments and trailing commas. Custom profile locations can opt in explicitly:

```bash
mcp-config-doctor --config custom-profile/mcp.json --jsonc
```

Other files keep strict JSON validation. JSONC support does not accept JSON5 keys/single quotes, evaluate code, resolve input variables or verify client-specific schema extensions. See [VS Code JSON editing](https://code.visualstudio.com/Docs/languages/json).

Non-default VS Code profiles, portable/custom editor data directories, and Cline IDE extension storage are not enumerated automatically. Open the actual file using VS Code **MCP: Open User Configuration** or Cline **Configure MCP Servers**, then pass it with `--config` (plus `--jsonc` when appropriate). [Cline documents its CLI override and IDE flow here](https://docs.cline.bot/mcp/mcp-overview).

## Codex uses TOML, which is not supported yet

[Official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) specifies `~/.codex/config.toml` and trusted-project `.codex/config.toml`, with `[mcp_servers.<server-name>]` tables. Native TOML is unsupported, even with `--jsonc`; no `.codex/mcp.json` candidate is invented. A passing custom JSON/JSONC diagnosis does not validate native Codex configuration.
