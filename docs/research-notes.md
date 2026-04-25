# Research Notes

## Decision

Build a small MCP config diagnostic CLI instead of another MCP server template.

## Evidence

- MCP has become a visible AI developer tooling category, with official docs, SDKs, inspectors, registries, and many server repos.
- Existing projects cluster around server creation, server inspection, registries, and security scanning.
- A lower-friction gap remains: developers often fail at client-side config before they can use an inspector or a security scanner.

## Positioning

`mcp-config-doctor` targets the first 10 minutes of MCP setup:

- Is the JSON valid?
- Is the server block in the right shape?
- Can the client find the command?
- Are args/env formatted correctly?
- Did someone paste a secret into a config file?

This is narrower than a scanner and easier to adopt in README docs, issues, and CI examples.

## Sources

- Official MCP documentation: https://modelcontextprotocol.io/
- GitHub MCP organization: https://github.com/modelcontextprotocol
- MCP Inspector: https://github.com/modelcontextprotocol/inspector
- GitHub search for MCP security scanners: https://github.com/search?q=mcp+security+scanner&type=repositories

