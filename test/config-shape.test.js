import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { diagnoseConfig } from '../src/doctor.js'

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-shape-fixture-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-shape-fixture-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return directory
}

function report(directory, value, options) {
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify(value))
  return diagnoseConfig(config, options)
}

test('synthetic client fixtures identify bad args, tokens and empty environment without Codex claims', () => {
  const cursor = diagnoseConfig('fixtures/cursor-copilot-schema.mcp.json')
  assert.ok(cursor.results.some((item) => item.check === 'memory:args' && item.status === 'FAIL'))
  const custom = diagnoseConfig('fixtures/custom-json-redacted-mistakes.mcp.json')
  assert.ok(custom.results.some((item) => item.check === 'repo-tools:secret:GITHUB_TOKEN' && item.status === 'WARN'))
  assert.ok(custom.results.some((item) => item.check === 'broken-json-helper:env:OPENAI_API_KEY' && item.status === 'WARN'))
})

test('non-object roots and server maps produce diagnostic reports instead of throwing', (t) => {
  const directory = fixture(t)
  for (const value of [null, [], 42, true, 'synthetic', { mcpServers: [] }, { servers: ['synthetic'] }, { mcpServers: null }]) {
    const result = report(directory, value)
    assert.ok(result.results.some((item) => item.status === 'FAIL'), `expected failure for ${JSON.stringify(value)}`)
    assert.ok(result.score < 70)
  }
  const badServer = report(directory, { servers: { synthetic: [] } })
  assert.ok(badServer.results.some((item) => item.check === 'synthetic' && item.status === 'FAIL'))
})

test('invalid args or environment prevents explicit startup rather than dropping or coercing values', (t) => {
  const directory = fixture(t)
  const marker = path.join(directory, 'unexpected-start')
  const script = path.join(directory, 'server.cjs')
  fs.writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'synthetic')`)
  const cases = [
    { args: 'synthetic' }, { args: null }, { args: [script, 123] }, { args: [script, null] },
    { env: [] }, { env: null }, { env: { SYNTHETIC: 123 } }, { env: { SYNTHETIC: {} } },
  ]
  for (const invalid of cases) {
    const result = report(directory, { mcpServers: { synthetic: { command: process.execPath, args: [script], ...invalid } } }, { start: true, timeoutMs: 1000 })
    const field = Object.hasOwn(invalid, 'args') ? 'args' : 'env'
    assert.ok(result.results.some((item) => item.check === `synthetic:${field}` && item.status === 'FAIL'), field)
    assert.equal(result.results.some((item) => item.check === 'synthetic:start'), false)
    assert.equal(fs.existsSync(marker), false)
  }
})

test('CLI treats a null config as a failed diagnostic rather than an internal error', (t) => {
  const directory = fixture(t)
  const config = path.join(directory, 'null.json')
  fs.writeFileSync(config, 'null')
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--config', config, '--json'], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.ok(JSON.parse(result.stdout).results.some((item) => item.status === 'FAIL'))
})


test('native VS Code string, number and null environment values keep their documented meaning', (t) => {
  const directory = fixture(t)
  const marker = path.join(directory, 'native-environment.json')
  const key = 'MCP_DOCTOR_SYNTHETIC_REMOVE'
  const previous = process.env[key]
  process.env[key] = 'synthetic-inherited'
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
  const script = path.join(directory, 'native.cjs')
  fs.writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ port: process.env.MCP_DOCTOR_SYNTHETIC_PORT, text: process.env.MCP_DOCTOR_SYNTHETIC_TEXT, removed: process.env.${key} }))`)
  const value = { servers: { native: { type: 'stdio', command: process.execPath, args: [script], env: { MCP_DOCTOR_SYNTHETIC_PORT: 3000, MCP_DOCTOR_SYNTHETIC_TEXT: 'synthetic-text', [key]: null } } } }
  const inert = report(directory, value)
  assert.equal(inert.results.some((item) => item.check.startsWith('native:env') && item.status !== 'PASS'), false)
  assert.equal(fs.existsSync(marker), false)
  const started = report(directory, value, { start: true, timeoutMs: 1000 })
  assert.ok(started.results.some((item) => item.check === 'native:start' && item.status === 'PASS'))
  assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), { port: '3000', text: 'synthetic-text' })
  for (const invalid of [true, [], {}]) {
    const result = report(directory, { servers: { native: { command: process.execPath, env: { SYNTHETIC: invalid } } } })
    assert.ok(result.results.some((item) => item.check === 'native:env' && item.status === 'FAIL'))
  }
})
