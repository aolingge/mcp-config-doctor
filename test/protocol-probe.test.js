import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url))
function fixture(t, body) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-protocol-fixture-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-protocol-fixture-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const pid = path.join(directory, 'child.pid')
  const transcript = path.join(directory, 'requests.jsonl')
  const script = path.join(directory, 'server.cjs')
  fs.writeFileSync(script, `
    const fs = require('node:fs');
    fs.writeFileSync(${JSON.stringify(pid)}, String(process.pid));
    require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
      const request = JSON.parse(line);
      fs.appendFileSync(${JSON.stringify(transcript)}, line + '\\n');
      ${body}
    });
    setInterval(() => {}, 1000);
  `)
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify({ mcpServers: { synthetic: { command: process.execPath, args: [script], permissions: ['synthetic'] } } }))
  return { directory, pid, transcript, config }
}
function invoke(config, ...args) {
  return spawnSync(process.execPath, [cli, '--config', config, '--json', '--min-score', '100', ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 128 * 1024 })
}
function assertReaped(pidFile) {
  const pid = Number(fs.readFileSync(pidFile, 'utf8'))
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
}
const legacy = `{ protocolVersion: request.params.protocolVersion, capabilities: {}, serverInfo: { name: 'synthetic-server', version: '1' } }`
const modern = `{ resultType: 'complete', supportedVersions: ['2026-07-28'], capabilities: {}, ttlMs: 0, cacheScope: 'private' }`

test('normal diagnosis stays inert; initialize completes and reaps a long-lived synthetic child', (t) => {
  const files = fixture(t, `if (request.method === 'initialize') process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: ${legacy} }) + '\\n');`)
  const original = JSON.parse(fs.readFileSync(files.config, 'utf8'))
  fs.appendFileSync(original.mcpServers.synthetic.args[0], "\nprocess.on('SIGTERM', () => {});\n")
  assert.equal(invoke(files.config).status, 0)
  assert.equal(fs.existsSync(files.pid), false)
  const result = invoke(files.config, '--initialize')
  assert.equal(result.status, 0, result.stderr)
  assert.ok(JSON.parse(result.stdout).results.some((item) => item.check === 'synthetic:initialize' && item.status === 'PASS'))
  const requests = fs.readFileSync(files.transcript, 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(requests[0].method, 'initialize')
  assert.equal(requests[0].params.protocolVersion, '2025-11-25')
  assert.equal(requests.some((item) => /tools|resources|prompts/.test(item.method)), false)
  assertReaped(files.pid)
})

test('explicit discover uses modern metadata and accepts an anonymous server without fallback', (t) => {
  const files = fixture(t, `process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: ${modern} }) + '\\n');`)
  const result = invoke(files.config, '--discover')
  assert.equal(result.status, 0, result.stderr)
  assert.ok(JSON.parse(result.stdout).results.some((item) => item.check === 'synthetic:discover' && item.status === 'PASS'))
  const requests = fs.readFileSync(files.transcript, 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'server/discover')
  assert.equal(requests[0].params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28')
  assert.deepEqual(requests[0].params._meta['io.modelcontextprotocol/clientCapabilities'], {})
  assertReaped(files.pid)
})

test('legacy server pings receive empty responses before initialization, including a colliding request id', (t) => {
  for (const pingId of [1, 77, 'server-ping']) {
    const files = fixture(t, `
      if (request.method === 'initialize') {
        global.initializeRequest = request;
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: ${JSON.stringify(pingId)}, method: 'ping' }) + '\\n');
      } else if (request.id === ${JSON.stringify(pingId)} && request.result && Object.keys(request.result).length === 0) {
        const request = global.initializeRequest;
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: ${legacy} }) + '\\n');
      }
    `)
    const result = invoke(files.config, '--initialize', '--timeout-ms', '1000')
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const requests = fs.readFileSync(files.transcript, 'utf8').trim().split('\n').map(JSON.parse)
    assert.deepEqual(requests[1], { jsonrpc: '2.0', id: pingId, result: {} })
    assert.equal(requests[2].method, 'notifications/initialized')
    assertReaped(files.pid)
  }
})

test('malformed, incompatible and error responses never pass or expose server text', (t) => {
  const cases = [
    ['--initialize', `{ result: true }`],
    ['--initialize', `{ jsonrpc: '1.0', result: ${legacy} }`],
    ['--initialize', `{ result: ${legacy}, error: {} }`],
    ['--initialize', `{ method: 'initialize', result: ${legacy} }`],
    ['--initialize', `{ result: { protocolVersion: '2025-11-25', capabilities: {} } }`],
    ['--initialize', `{ result: { protocolVersion: '2099-01-01', capabilities: {}, serverInfo: { name: 'synthetic', version: '1' } } }`],
    ['--discover', `{ result: { resultType: 'complete', supportedVersions: ['2025-11-25'], capabilities: {} } }`],
    ['--discover', `{ result: { supportedVersions: ['2026-07-28'], capabilities: {} } }`],
    ['--initialize', `{ error: { code: -32603, message: 'synthetic-private-error', data: { private: 'synthetic-private-data' } } }`],
  ]
  for (const [mode, fields] of cases) {
    const files = fixture(t, `process.stderr.write('synthetic-private-stderr'); process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...${fields} }) + '\\n');`)
    const result = invoke(files.config, mode)
    assert.equal(result.status, 1, result.stderr)
    assert.ok(JSON.parse(result.stdout).results.some((item) => item.check === 'synthetic:' + mode.slice(2) && item.status === 'FAIL'))
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private/)
    assertReaped(files.pid)
  }
})

test('output and silent-child limits produce bounded reports and reap direct children', (t) => {
  for (const body of ['', `process.stdout.write('synthetic-private-output'.repeat(10000));`, `process.stderr.write('synthetic-private-stderr'.repeat(10000));`]) {
    const files = fixture(t, body)
    const result = invoke(files.config, '--initialize', '--timeout-ms', '500')
    assert.equal(result.status, 1, result.stderr)
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private/)
    assert.ok(result.stdout.length < 5000)
    assertReaped(files.pid)
  }
})

test('incompatible probe options and malformed deadlines fail before any launch', (t) => {
  const files = fixture(t, '')
  for (const args of [['--initialize', '--discover'], ['--start', '--initialize'], ['--start', '--discover'], ['--initialize', '--timeout-ms', 'NaN'], ['--initialize', '--timeout-ms', '0'], ['--initialize', '--timeout-ms', '60001'], ['--initialize', '--timeout-ms'], ['--initialize', '--timeout-ms', '--json'], ['--initialize', '--profile', 'manifest']]) {
    const result = invoke(files.config, ...args)
    assert.equal(result.status, 2)
    assert.equal(fs.existsSync(files.pid), false)
  }
})

test('unsupported native-client launch settings and malformed entries never launch a protocol child', (t) => {
  const files = fixture(t, '')
  const original = JSON.parse(fs.readFileSync(files.config, 'utf8'))
  for (const settings of [{ cwd: '.' }, { envFile: '.env' }, { sandboxEnabled: true }, { disabled: true }, { type: 'http' }, { args: ['${workspaceFolder}/server.js'] }, { env: { SYNTHETIC: '${input:value}' } }, { args: [123] }, { env: [] }]) {
    const value = structuredClone(original)
    Object.assign(value.mcpServers.synthetic, settings)
    fs.writeFileSync(files.config, JSON.stringify(value))
    for (const mode of ['--initialize', '--start']) {
      const result = invoke(files.config, mode)
      assert.equal(result.status, 1, result.stderr)
      assert.equal(fs.existsSync(files.pid), false)
      assert.ok(JSON.parse(result.stdout).results.some((item) => item.status !== 'PASS'))
    }
  }
})

test('startup deadlines reap the direct child even if it handles SIGTERM', (t) => {
  const files = fixture(t, '')
  const value = JSON.parse(fs.readFileSync(files.config, 'utf8'))
  fs.appendFileSync(value.mcpServers.synthetic.args[0], "\nprocess.on('SIGTERM', () => {});\n")
  const result = invoke(files.config, '--start', '--timeout-ms', '500')
  assert.equal(result.status, 0, result.stderr)
  assertReaped(files.pid)
})

test('sync diagnosis remains sync and the async API preserves invalid-config scores', async (t) => {
  const { diagnoseConfig, diagnoseConfigAsync } = await import('../src/doctor.js')
  const files = fixture(t, '')
  assert.equal(typeof diagnoseConfig(files.config).then, 'undefined')
  assert.throws(() => diagnoseConfig(files.config, { initialize: true }), /diagnoseConfigAsync/)
  fs.writeFileSync(files.config, 'null')
  assert.deepEqual(await diagnoseConfigAsync(files.config, { initialize: true }), diagnoseConfig(files.config))
  assert.equal(fs.existsSync(files.pid), false)
  await assert.rejects(diagnoseConfigAsync(files.config, { initialize: true, timeoutMs: 0 }), /timeout-ms/)
})
