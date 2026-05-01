#!/usr/bin/env node
import fs from 'node:fs'
import process from 'node:process'
import { defaultConfigCandidates, diagnoseConfig, formatAnnotations, formatMarkdown, formatSarif, formatText } from './doctor.js'

const VERSION = '0.1.0'

function parseArgs(argv) {
  const args = {
    config: null,
    minScore: 70,
    markdown: false,
    json: false,
    sarif: false,
    annotations: false,
    start: false,
    initialize: false,
    version: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--config') args.config = argv[++index]
    else if (item === '--min-score') args.minScore = Number(argv[++index])
    else if (item === '--markdown') args.markdown = true
    else if (item === '--json') args.json = true
    else if (item === '--sarif') args.sarif = true
    else if (item === '--annotations') args.annotations = true
    else if (item === '--start') args.start = true
    else if (item === '--initialize') args.initialize = true
    else if (item === '--version') args.version = true
    else if (item === '-h' || item === '--help') args.help = true
    else throw new Error(`Unknown option: ${item}`)
  }
  return args
}

function help() {
  console.log(`mcp-config-doctor v${VERSION}

Usage:
  mcp-config-doctor --config claude_desktop_config.json
  mcp-config-doctor --config mcp.json --start
  mcp-config-doctor --config mcp.json --initialize
  mcp-config-doctor --markdown > mcp-report.md

Options:
  --config FILE      MCP client config file
  --start            run a short startup probe for local stdio servers
  --initialize       launch local stdio servers and send a minimal MCP initialize request
  --min-score N      fail below score, default: 70
  --markdown         print markdown report
  --json             print raw JSON report
  --sarif            print SARIF 2.1.0 report
  --annotations      print GitHub Actions warnings
  --version          print version
`)
}

function findConfig() {
  return defaultConfigCandidates().find((candidate) => fs.existsSync(candidate))
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.version) {
    console.log(VERSION)
    process.exit(0)
  }
  if (args.help) {
    help()
    process.exit(0)
  }

  const configPath = args.config ?? findConfig()
  if (!configPath) {
    throw new Error('No config found. Pass --config path/to/mcp.json')
  }

  const report = diagnoseConfig(configPath, { start: args.start, initialize: args.initialize })

  if (args.json) console.log(JSON.stringify(report, null, 2))
  else if (args.markdown) console.log(formatMarkdown(report))
  else if (args.sarif) console.log(JSON.stringify(formatSarif(report), null, 2))
  else if (args.annotations) console.log(formatAnnotations(report))
  else console.log(formatText(report))

  process.exit(report.score >= args.minScore ? 0 : 1)
} catch (error) {
  console.error(`mcp-config-doctor: ${error.message}`)
  process.exit(2)
}
