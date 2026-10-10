import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { diagnoseConfig } from '../src/doctor.js'

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-command-lookup-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-command-lookup-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return directory
}

test('ordinary diagnosis never evaluates POSIX shell syntax in a configured command', { skip: process.platform === 'win32' }, (t) => {
  const directory = fixture(t)
  const marker = path.join(directory, 'unexpected-execution.txt')
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify({
    mcpServers: { synthetic: { command: `"${process.execPath}" & echo DOCTOR_SYNTHETIC > "${marker}"` } },
  }))
  const report = diagnoseConfig(config)
  assert.equal(fs.existsSync(marker), false, 'a default diagnostic executed shell syntax')
  assert.ok(report.results.some((item) => item.check === 'synthetic:path' && item.status === 'WARN'))
})

test('an executable path containing spaces is recognized without launching it', (t) => {
  const directory = fixture(t)
  const command = path.join(directory, 'synthetic tool.cmd')
  fs.writeFileSync(command, 'exit 19\n', { mode: 0o755 })
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify({ mcpServers: { synthetic: { command } } }))
  const report = diagnoseConfig(config)
  assert.ok(report.results.some((item) => item.check === 'synthetic:path' && item.status === 'PASS'))
})

test('PATH lookup recognizes node but does not accept a directory as a command', (t) => {
  const directory = fixture(t)
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify({ mcpServers: {
    available: { command: 'node' },
    directory: { command: directory },
  } }))
  const report = diagnoseConfig(config)
  assert.ok(report.results.some((item) => item.check === 'available:path' && item.status === 'PASS'))
  assert.ok(report.results.some((item) => item.check === 'directory:path' && item.status === 'WARN'))
})

test('Windows also searches the current directory when PATH does not contain it', { skip: process.platform !== 'win32' }, (t) => {
  const directory = fixture(t)
  const config = path.join(directory, 'config.json')
  fs.writeFileSync(config, JSON.stringify({ mcpServers: { synthetic: { command: path.basename(process.execPath) } } }))
  const script = `
    import { diagnoseConfig } from ${JSON.stringify(new URL('../src/doctor.js', import.meta.url).href)};
    console.log(JSON.stringify(diagnoseConfig(process.argv[1])));
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, config], {
    cwd: path.dirname(process.execPath),
    env: { ...process.env, PATH: path.join(directory, 'absent-path') },
    encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(JSON.parse(result.stdout).results.some((item) => item.check === 'synthetic:path' && item.status === 'PASS'))
})
