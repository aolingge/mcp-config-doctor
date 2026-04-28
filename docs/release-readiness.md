# Release Readiness

This checklist keeps `mcp-config-doctor` releases repeatable. The current npm-ready release is `0.1.1`.

## Local Checks

Run before publishing a new version:

```bash
npm test
npm run check
npm pack --dry-run --json
```

Then smoke the public or packed package against a known-good config:

```bash
npx mcp-config-doctor --config fixtures/valid.mcp.json --min-score 80
```

## Package Contract

The npm package should include:

- `src/cli.js`
- `src/doctor.js`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `LICENSE`
- `docs/`
- `examples/`
- community health files

The package should not include real MCP configs, tokens, cookies, private logs, browser profiles, private URLs, or local credential paths.

## Public Links

- npm: https://www.npmjs.com/package/mcp-config-doctor
- source: https://github.com/aolingge/mcp-config-doctor

## Manual Release Boundary

Do not publish a new npm version, create a GitHub release, or post external launch copy until the local checks pass and the release notes match the package version.
