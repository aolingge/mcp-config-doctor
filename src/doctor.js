import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
]

export function defaultConfigCandidates(platform = process.platform, home = os.homedir()) {
  const candidates = []

  const homeScopedCandidates = [
    path.join(home, '.cursor', 'mcp.json'),
    path.join(home, '.codex', 'mcp.json'),
    path.join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
  ]

  if (platform === 'win32') {
    candidates.push(
      path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
      path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json'),
      ...homeScopedCandidates,
    )
  } else if (platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      ...homeScopedCandidates,
    )
  } else {
    candidates.push(
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      path.join(home, '.config', 'Code', 'User', 'mcp.json'),
      ...homeScopedCandidates,
    )
  }

  return candidates
}

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8')
  return {
    raw,
    json: JSON.parse(raw),
  }
}

export function extractServers(json) {
  if (json.mcpServers && typeof json.mcpServers === 'object') {
    return json.mcpServers
  }

  if (json.servers && typeof json.servers === 'object') {
    return json.servers
  }

  return null
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'command'
  const args = process.platform === 'win32' ? [command] : ['-v', command]
  const result = spawnSync(probe, args, { shell: process.platform !== 'win32', stdio: 'ignore' })
  return result.status === 0
}

function hasSecretLikeValue(value) {
  if (typeof value !== 'string') return false
  return secretPatterns.some((pattern) => pattern.test(value))
}

function makeResult(status, check, message, fix = null) {
  return { status, check, message, fix }
}

export function diagnoseConfig(configPath, options = {}) {
  const results = []
  const startChecks = options.start === true
  let loaded

  try {
    loaded = loadConfig(configPath)
    results.push(makeResult('PASS', 'json', 'Config is valid JSON'))
  } catch (error) {
    return {
      file: configPath,
      score: 0,
      results: [makeResult('FAIL', 'json', `Cannot parse config: ${error.message}`, 'Fix JSON syntax first.')],
    }
  }

  const servers = extractServers(loaded.json)
  if (!servers) {
    return {
      file: configPath,
      score: 20,
      results: [
        ...results,
        makeResult('FAIL', 'servers', 'No mcpServers or servers object found', 'Add a top-level mcpServers object.'),
      ],
    }
  }

  const entries = Object.entries(servers)
  if (entries.length === 0) {
    results.push(makeResult('FAIL', 'servers', 'No MCP servers configured', 'Add at least one server entry.'))
  } else {
    results.push(makeResult('PASS', 'servers', `${entries.length} server(s) configured`))
  }

  for (const [name, server] of entries) {
    if (!server || typeof server !== 'object') {
      results.push(makeResult('FAIL', name, 'Server config is not an object', 'Use an object with command, args, and env.'))
      continue
    }

    if (server.command && typeof server.command === 'string') {
      results.push(makeResult('PASS', `${name}:command`, `command is ${server.command}`))
      if (commandExists(server.command)) {
        results.push(makeResult('PASS', `${name}:path`, `${server.command} is available in PATH`))
      } else {
        results.push(makeResult('WARN', `${name}:path`, `${server.command} is not in PATH`, 'Install it or use an absolute command path.'))
      }
    } else if (server.url && typeof server.url === 'string') {
      results.push(makeResult('PASS', `${name}:url`, `remote server URL is configured`))
    } else {
      results.push(makeResult('FAIL', `${name}:command`, 'Missing command or url', 'Add command for stdio server or url for remote server.'))
    }

    if (server.args && !Array.isArray(server.args)) {
      results.push(makeResult('FAIL', `${name}:args`, 'args must be an array', 'Use "args": ["arg1", "arg2"].'))
    }

    if (server.env && typeof server.env !== 'object') {
      results.push(makeResult('FAIL', `${name}:env`, 'env must be an object', 'Use "env": {"KEY": "value"}.'))
    }

    const env = server.env && typeof server.env === 'object' ? server.env : {}
    for (const [key, value] of Object.entries(env)) {
      if (value === '' || value === null || value === undefined) {
        results.push(makeResult('WARN', `${name}:env:${key}`, 'Environment variable is empty', 'Set the value in your local MCP config or secret store.'))
      }
      if (hasSecretLikeValue(value)) {
        results.push(makeResult('WARN', `${name}:secret:${key}`, 'Secret-like value found in config', 'Prefer environment references or client secret storage.'))
      }
    }

    if (startChecks && server.command && typeof server.command === 'string' && commandExists(server.command)) {
      const args = Array.isArray(server.args) ? server.args : []
      const result = spawnSync(server.command, args, {
        env: { ...process.env, ...env },
        timeout: options.timeoutMs ?? 2500,
        stdio: 'ignore',
      })
      if (result.error?.code === 'ETIMEDOUT') {
        results.push(makeResult('PASS', `${name}:start`, 'Process stayed alive during startup probe'))
      } else if (result.status === 0 || result.status === null) {
        results.push(makeResult('PASS', `${name}:start`, 'Startup probe did not fail immediately'))
      } else {
        results.push(makeResult('WARN', `${name}:start`, `Process exited with code ${result.status}`, 'Run the command manually to inspect stderr.'))
      }
    }
  }

  const score = scoreResults(results)
  return { file: configPath, score, results }
}

export function scoreResults(results) {
  const weights = { PASS: 1, WARN: 0.5, FAIL: 0 }
  const total = results.length || 1
  const sum = results.reduce((value, result) => value + weights[result.status], 0)
  return Math.round((sum / total) * 100)
}

export function formatText(report) {
  const lines = [`MCP config score: ${report.score}/100`, `File: ${report.file}`, '']
  for (const result of report.results) {
    lines.push(`${result.status.padEnd(5)} ${result.check.padEnd(22)} ${result.message}`)
    if (result.fix) lines.push(`      Fix: ${result.fix}`)
  }
  return lines.join('\n')
}

export function formatMarkdown(report) {
  const rows = report.results
    .map((result) => `| ${result.status} | ${result.check} | ${result.message} | ${result.fix ?? ''} |`)
    .join('\n')
  return `# MCP Config Doctor Report

Score: **${report.score}/100**

File: \`${report.file}\`

| Status | Check | Message | Fix |
| --- | --- | --- | --- |
${rows}
`
}

export function formatAnnotations(report) {
  return report.results
    .filter((result) => result.status !== 'PASS')
    .map((result) => `::warning file=${report.file},title=${result.check}::${result.message}${result.fix ? ` Fix: ${result.fix}` : ''}`)
    .join('\n')
}

export function formatSarif(report) {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: { driver: { name: 'mcp-config-doctor', informationUri: 'https://github.com/aolingge/mcp-config-doctor' } },
        results: report.results
          .filter((result) => result.status !== 'PASS')
          .map((result) => ({
            ruleId: result.check,
            level: result.status === 'FAIL' ? 'error' : 'warning',
            message: { text: result.fix ? `${result.message} Fix: ${result.fix}` : result.message },
            locations: [{ physicalLocation: { artifactLocation: { uri: report.file } } }],
          })),
      },
    ],
  }
}
