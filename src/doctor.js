import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gitee_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
]
const secretLikePattern = /(ghp_|github_pat_|gitee_[A-Za-z0-9_]*|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})[A-Za-z0-9_-]*/g
const assignmentSecretPattern = /(token|password|secret|cookie)\s*[:=]\s*[^\s]+/gi

const profileChecks = {
  manifest: {
    title: 'MCP Manifest Lint',
    checks: [
      ['name', 'name|id|名称', 'Has server name or id.'],
      ['transport', 'stdio|http|sse|transport|传输', 'Mentions transport.'],
      ['target', 'command|url|endpoint|args|目标|命令', 'Has command or URL target.'],
      ['permissions', 'permission|scope|read|write|权限|范围', 'Mentions permissions.'],
    ],
  },
  'permission-matrix': {
    title: 'MCP Permission Matrix',
    readTarget: true,
    checks: [
      ['tool', 'tool|command|function|工具|命令', 'Lists tools or commands.'],
      ['permission', 'permission|scope|read|write|权限|范围', 'Lists permissions.'],
      ['data', 'data|file|network|secret|数据|文件|网络|密钥', 'Documents data access.'],
      ['risk', 'risk|safe|danger|风险|安全', 'Explains risks.'],
    ],
  },
  'env-template': {
    title: 'MCP Env Template Check',
    checks: [
      ['placeholder', 'YOUR_|<.*>|example|placeholder|示例|占位', 'Uses placeholders instead of real values.'],
      ['mcp-key', 'MCP|SERVER|TRANSPORT|PORT|TOKEN|API', 'Contains MCP-related environment keys.'],
      ['comments', '#|description|说明', 'Explains what values mean.'],
      ['no-secret', 'REDACTION_SPECIAL', 'Does not contain obvious raw secrets.'],
    ],
  },
  'tool-name': {
    title: 'MCP Tool Name Lint',
    checks: [
      ['has-tools', 'tools?|name|description|工具|名称', 'Contains tool names and descriptions.'],
      ['specific', 'read_|write_|list_|search_|create_|delete_|get_|update_', 'Uses action-oriented names.'],
      ['description', 'description|desc|说明|描述', 'Includes descriptions.'],
      ['risk', 'delete|write|exec|shell|run|danger|删除|执行', 'Makes risky tools visible.'],
    ],
  },
  'server-smoke': {
    title: 'MCP Server Smoke Test',
    readTarget: true,
    checks: [
      ['start', 'start|run|stdio|http|启动|运行', 'Explains how to start.'],
      ['tools', 'list tools|tools/list|tool list|工具列表', 'Checks tool listing.'],
      ['call', 'call|invoke|sample|example|调用|示例', 'Includes a sample call.'],
      ['failure', 'error|timeout|fail|失败|超时', 'Explains failure handling.'],
    ],
  },
}

export const PROFILE_NAMES = ['config', ...Object.keys(profileChecks)]

export function defaultConfigCandidates(platform = process.platform, home = os.homedir()) {
  const candidates = []
  const pathApi = platform === 'win32' ? path.win32 : path
  const sharedCandidates = [
    pathApi.join(home, '.cursor', 'mcp.json'),
    pathApi.join(home, '.codex', 'mcp.json'),
    pathApi.join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    pathApi.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
  ]

  if (platform === 'win32') {
    candidates.push(
      pathApi.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
      pathApi.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json'),
      ...sharedCandidates,
    )
  } else if (platform === 'darwin') {
    candidates.push(
      pathApi.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      pathApi.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      ...sharedCandidates,
    )
  } else {
    candidates.push(
      pathApi.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      pathApi.join(home, '.config', 'Code', 'User', 'mcp.json'),
      ...sharedCandidates,
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

function hasPermissionSignal(server) {
  if (!server || typeof server !== 'object') return false
  const directKeys = ['permissions', 'permission', 'scope', 'scopes', 'read', 'write', 'tools']
  return directKeys.some((key) => Object.prototype.hasOwnProperty.call(server, key))
}

function makeResult(status, check, message, fix = null) {
  return { status, check, message, fix }
}

function redactText(text) {
  return text
    .replace(secretLikePattern, '[REDACTED_SECRET]')
    .replace(assignmentSecretPattern, '$1=[REDACTED]')
}

function listReadableFiles(root) {
  const files = []
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (entry.isFile() && /\.(md|txt|json|ya?ml|log|env|js|ts)$/i.test(fullPath)) files.push(fullPath)
      if (files.length >= 120) return
    }
  }
  visit(root)
  return files
}

function readTarget(target) {
  const stat = fs.statSync(target)
  if (!stat.isDirectory()) return fs.readFileSync(target, 'utf8')

  return listReadableFiles(target)
    .map((file) => `\n--- ${path.relative(target, file)} ---\n${fs.readFileSync(file, 'utf8')}`)
    .join('\n')
}

export function diagnoseProfileText(text, target = '<inline>', profile = 'manifest') {
  const config = profileChecks[profile]
  if (!config) throw new Error(`Unknown profile "${profile}". Use one of: ${PROFILE_NAMES.join(', ')}`)
  const source = redactText(text)
  const results = config.checks.map(([id, pattern, message]) => {
    const ok = pattern === 'REDACTION_SPECIAL'
      ? !secretPatterns.some((secretPattern) => secretPattern.test(text))
      : new RegExp(pattern, 'i').test(source)
    return makeResult(ok ? 'PASS' : 'FAIL', id, ok ? message : `Missing signal: ${message}`)
  })
  return {
    file: target,
    profile,
    title: config.title,
    score: scoreResults(results),
    results,
    redacted: source,
  }
}

export function diagnoseProfile(target, profile = 'manifest') {
  const config = profileChecks[profile]
  if (!config) throw new Error(`Unknown profile "${profile}". Use one of: ${PROFILE_NAMES.join(', ')}`)
  const text = config.readTarget ? readTarget(target) : fs.readFileSync(target, 'utf8')
  return diagnoseProfileText(text, target, profile)
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

    if (hasPermissionSignal(server)) {
      results.push(makeResult('PASS', `${name}:permissions`, 'permissions or scope signal is documented'))
    } else {
      results.push(makeResult(
        'WARN',
        `${name}:permissions`,
        'No permissions or scope signal found',
        'Document expected filesystem, network, shell, browser, or API access for this MCP server.',
      ))
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
  const title = report.title ?? 'MCP config'
  const lines = [`${title} score: ${report.score}/100`, `File: ${report.file}`, '']
  for (const result of report.results) {
    lines.push(`${result.status.padEnd(5)} ${result.check.padEnd(22)} ${result.message}`)
    if (result.fix) lines.push(`      Fix: ${result.fix}`)
  }
  return lines.join('\n')
}

export function formatMarkdown(report) {
  const title = report.title ?? 'MCP Config Doctor'
  const rows = report.results
    .map((result) => `| ${result.status} | ${result.check} | ${result.message} | ${result.fix ?? ''} |`)
    .join('\n')
  return `# ${title} Report

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
