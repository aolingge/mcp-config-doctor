# Security Policy

## Reporting

Please do not publish real secrets, private config files, cookies, or server logs in issues.

If you find a bug that can expose secrets or execute unexpected commands, open a private security advisory on GitHub or contact the maintainer through the GitHub profile.

## Scope

`mcp-config-doctor` is a local configuration diagnostic tool. It does not upload config files and does not call remote services during normal checks.

The optional `--start` flag starts local commands from your MCP config for a short probe. Use it only with config files you trust.

