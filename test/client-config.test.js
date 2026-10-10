import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defaultConfigCandidates, loadConfig, diagnoseConfig, diagnoseProfileText } from '../src/doctor.js'

test('JSONC profile source redaction handles structured credentials and comments', () => {
  const source = '{ /* synthetic-comment */ "credentials": { "one": "synthetic-first", "two": "synthetic-second", }, }'
  for (const prefix of ['', '// synthetic-prefix\n', '/* synthetic-prefix */\n']) {
    assert.doesNotMatch(diagnoseProfileText(prefix + source).redacted, /synthetic/)
  }
})

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-client-fixture-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-client-fixture-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return directory
}

test('platform discovery respects documented override paths and workspace locations', () => {
  for (const [platform, home, cwd, base] of [
    ['win32', 'C:\\Users\\tester', 'D:\\project', 'R:\\settings'],
    ['linux', '/home/tester', '/project', '/settings'],
    ['darwin', '/Users/tester', '/project', '/settings'],
  ]) {
    const p = platform === 'win32' ? path.win32 : path.posix
    const env = { APPDATA: base, XDG_CONFIG_HOME: base, COPILOT_HOME: p.join(base, 'copilot'), CLINE_MCP_SETTINGS_PATH: p.join(base, 'cline.json') }
    const candidates = defaultConfigCandidates(platform, home, cwd, env)
    assert.ok(candidates.includes(p.join(cwd, '.mcp.json')))
    assert.ok(candidates.includes(p.join(cwd, '.vscode', 'mcp.json')))
    assert.ok(candidates.includes(p.join(cwd, '.cursor', 'mcp.json')))
    assert.ok(candidates.includes(env.CLINE_MCP_SETTINGS_PATH))
    assert.ok(candidates.includes(p.join(env.COPILOT_HOME, 'mcp-config.json')))
    assert.ok(!candidates.includes(p.join(home, '.copilot', 'mcp-config.json')))
    assert.ok(!candidates.includes(p.join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json')))
    assert.ok(!candidates.some((value) => /\.codex|globalStorage/.test(value)))
    assert.equal(new Set(candidates).size, candidates.length)
    if (platform !== 'darwin') assert.equal(candidates[0], p.join(base, 'Claude', 'claude_desktop_config.json'))
  }
})

test('VSCode JSONC preserves strings while accepting comments and trailing commas', (t) => {
  const directory = fixture(t)
  fs.mkdirSync(path.join(directory, '.vscode'))
  const config = path.join(directory, '.vscode', 'mcp.json')
  const expected = { servers: { demo: { url: 'https://example.com/mcp//path/*literal*/', env: { TEXT: 'escaped "quote",}' }, permissions: ['read'] } } }
  const source = '\ufeff{\n // local comment\n "servers": {"demo": {"url": "https://example.com/mcp//path/*literal*/",\n "env": {"TEXT": "escaped \\"quote\\",}",}, "permissions": ["read",], /* block */},},\n}'
  fs.writeFileSync(config, source)
  assert.deepEqual(loadConfig(config).json, expected)
  assert.equal(diagnoseConfig(config).score, 100)
})

test('strict JSON remains strict; custom profile paths opt into JSONC explicitly', (t) => {
  const directory = fixture(t)
  const config = path.join(directory, 'custom-profile.json')
  fs.writeFileSync(config, '{ // comment\n "servers": {"demo": {"url":"https://example.com/mcp", "scope":"read",},},}')
  assert.equal(diagnoseConfig(config).score, 0)
  assert.equal(diagnoseConfig(config, { jsonc: true }).score, 100)
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--config', config, '--jsonc', '--json'], { encoding: 'utf8' })
  assert.equal(cli.status, 0)
  assert.equal(JSON.parse(cli.stdout).score, 100)
})

test('JSONC rejects unterminated comments, malformed commas and JSON5 syntax', (t) => {
  const directory = fixture(t)
  const config = path.join(directory, 'custom.json')
  for (const source of ['{/* synthetic-unclosed', '{"servers": {},,}', '{"servers": [1,,]}', '{,}', '[,]', "{'servers': {}}", '{servers: {}}', '{"servers": {} synthetic-trailer}']) {
    fs.writeFileSync(config, source)
    const report = diagnoseConfig(config, { jsonc: true })
    assert.equal(report.score, 0, source)
    assert.doesNotMatch(JSON.stringify(report), /synthetic/)
  }
})

test('CLI discovers a synthetic workspace file without executing its command', (t) => {
  const directory = fixture(t)
  const syntheticHome = path.join(directory, 'home')
  fs.mkdirSync(syntheticHome)
  const marker = path.join(directory, 'unexpected-execution')
  fs.writeFileSync(path.join(directory, '.mcp.json'), JSON.stringify({ mcpServers: { synthetic: { command: 'node', args: ['-e', `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "executed")`], permissions: ['read'] } } }))
  const env = { ...process.env, HOME: syntheticHome, USERPROFILE: syntheticHome, APPDATA: path.join(syntheticHome, 'AppData'), XDG_CONFIG_HOME: path.join(syntheticHome, '.config'), COPILOT_HOME: path.join(syntheticHome, '.copilot'), CLINE_MCP_SETTINGS_PATH: path.join(syntheticHome, 'missing.json') }
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--json'], { cwd: directory, env, encoding: 'utf8' })
  assert.equal(cli.status, 0, cli.stderr)
  assert.equal(JSON.parse(cli.stdout).file, path.join(directory, '.mcp.json'))
  assert.equal(fs.existsSync(marker), false)
})
