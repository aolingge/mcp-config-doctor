# Quality Gates

This document explains how to use MCP Config Doctor as a repeatable quality gate before an AI agent, maintainer, or CI job marks work as done.

## Recommended Gate

```bash
npm run check
```

For CLI repositories, keep the gate small enough to run on every pull request. The goal is to catch missing signals early, not to replace human review.

## Output Modes

Use the most useful output for your workflow:

- Text output for local development.
- `--json` for scripts and dashboards.
- `--markdown` for release notes or issue comments.
- `--sarif` for GitHub code scanning when the CLI supports it.
- `--annotations` for GitHub Actions log annotations when the CLI supports it.

## Exit Codes

Use exit codes as automation boundaries:

- `0`: the checked file or repository meets the configured minimum score.
- `1`: the check ran, but the score is below the threshold.
- `2`: the command failed because of invalid input, missing files, or unsupported options.

## Agent Workflow

1. Run the gate before handing a repository to an AI coding agent.
2. Let the agent fix only the concrete missing signals.
3. Run the gate again after the agent finishes.
4. Attach the command and result to the pull request or release note.

## Security Notes

- Do not paste secrets, tokens, cookies, or private logs into public issues.
- Prefer fixtures and redacted examples when reporting false positives.
- Keep thresholds conservative in CI until the project has enough real-world samples.

## Links

- GitHub: https://github.com/aolingge/mcp-config-doctor
- Gitee: https://gitee.com/aolingge/mcp-config-doctor
