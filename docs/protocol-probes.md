# Explicit stdio probes

Ordinary diagnosis reads configuration and command paths without starting a server. Select exactly one process probe explicitly, preferably with an explicit configuration path:

```bash
mcp-config-doctor --config mcp.json --start --timeout-ms 2500
mcp-config-doctor --config mcp.json --initialize --timeout-ms 2500
mcp-config-doctor --config mcp.json --discover --timeout-ms 2500
```

- `--start` checks immediate process startup only. Staying alive until the deadline does not establish MCP protocol support.
- `--initialize` sends legacy MCP `initialize` offering `2025-11-25`, validates a response using a supported older revision, then writes `notifications/initialized`. Supported replies: `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`.
- `--discover` sends `server/discover` with the modern per-request metadata envelope pinned to `2026-07-28`. It checks `resultType`, advertised versions and capability-container shape. Modern identity metadata is optional; no identity or server-supplied instructions are displayed.

There is no automatic fallback or second server launch. The [official SDK protocol guide](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions) explains the two protocol eras and advises CLI tools to expose era probing explicitly. Wire shapes are documented in the [modern schema](https://modelcontextprotocol.io/specification/2026-07-28/schema#discoverresult) and [legacy lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).

The deadline is an integer from 100 to 60000 milliseconds per server, default 2500. Protocol probes retain at most 64 KiB of combined stdout/stderr, process newline-delimited JSON-RPC, and stop after a matching result, error, limit or timeout. The direct child is terminated and escalation is bounded; this does not sandbox a command, remove its startup side effects or guarantee cleanup of descendants. Raw server output and spawn errors are omitted from reports. These probes send no tool/resource/prompt requests and do not establish server safety or complete protocol conformance.

Only literal `command`, string `args` and supported `env` values are launched. Entries requiring `cwd`, `envFile`, variable expansion or sandboxing, disabled entries and incompatible transport types are skipped with a warning: run those with the native client. HTTP/OAuth probes and client input resolution are unsupported. A successful local probe does not prove a different client's launch context works.

The existing `diagnoseConfig(path, options)` API remains synchronous and supports ordinary/startup diagnosis. Protocol users call `await diagnoseConfigAsync(path, { initialize: true })` or `{ discover: true }`; this validates and loads the configuration once before probing eligible entries sequentially. The same deadline and mutually-exclusive-mode validation applies to CLI and asynchronous API calls.
