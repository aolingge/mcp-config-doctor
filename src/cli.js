#!/usr/bin/env node
import fs from 'node:fs'
import process from 'node:process'
import { defaultConfigCandidates, diagnoseConfig, formatMarkdown, formatText } from './doctor.js'

function parseArgs(argv) {
  const args = {
    config: null,
    minScore: 70,
    markdown: false,
    json: false,
    start: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--config') args.config = argv[++index]
    else if (item === '--min-score') args.minScore = Number(argv[++index])
    else if (item === '--markdown') args.markdown = true
    else if (item === '--json') args.json = true
    else if (item === '--start') args.start = true
    else if (item === '-h' || item === '--help') args.help = true
    else throw new Error(`Unknown option: ${item}`)
  }
  return args
}

function help() {
  console.log(`mcp-config-doctor

Usage:
  mcp-config-doctor --config claude_desktop_config.json
  mcp-config-doctor --config mcp.json --start
  mcp-config-doctor --markdown > mcp-report.md

Options:
  --config FILE      MCP client config file
  --start            run a short startup probe for local stdio servers
  --min-score N      fail below score, default: 70
  --markdown         print markdown report
  --json             print raw JSON report
`)
}

function findConfig() {
  return defaultConfigCandidates().find((candidate) => fs.existsSync(candidate))
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    help()
    process.exit(0)
  }

  const configPath = args.config ?? findConfig()
  if (!configPath) {
    throw new Error('No config found. Pass --config path/to/mcp.json')
  }

  const report = diagnoseConfig(configPath, { start: args.start })

  if (args.json) console.log(JSON.stringify(report, null, 2))
  else if (args.markdown) console.log(formatMarkdown(report))
  else console.log(formatText(report))

  process.exit(report.score >= args.minScore ? 0 : 1)
} catch (error) {
  console.error(`mcp-config-doctor: ${error.message}`)
  process.exit(2)
}
