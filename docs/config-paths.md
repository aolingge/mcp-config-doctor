# MCP Config Paths

These are starter paths used by the current home-directory auto-detection logic.

| Client | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` |
| VS Code | `%APPDATA%\Code\User\mcp.json` | `~/Library/Application Support/Code/User/mcp.json` | `~/.config/Code/User/mcp.json` |
| Cursor | `~\.cursor\mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` |
| Codex | `~\.codex\mcp.json` | `~/.codex/mcp.json` | `~/.codex/mcp.json` |
| Cline CLI | `~\.cline\data\settings\cline_mcp_settings.json` | `~/.cline/data/settings/cline_mcp_settings.json` | `~/.cline/data/settings/cline_mcp_settings.json` |
| Windsurf | `~\.codeium\windsurf\mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |

## Manual paths that still need `--config`

- VS Code workspace config: `.vscode/mcp.json`
- VS Code user-profile config: `mcp.json` inside a non-default VS Code user profile

`mcp-config-doctor` auto-discovers the stable default VS Code user config path above. Pass `--config` explicitly for workspace/profile-specific VS Code files, or open a pull request if your client uses another path.
