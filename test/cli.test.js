import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url))
const config = fileURLToPath(new URL('../fixtures/valid.mcp.json', import.meta.url))
const run = (args) => spawnSync(process.execPath, [cli, '--config', config, ...args], { encoding: 'utf8' })

test('invalid thresholds fail as usage errors before diagnosis', () => {
  for (const value of ['NaN', 'Infinity', '-1', '101', '']) {
    const result = run(['--min-score', value])
    assert.equal(result.status, 2, value)
    assert.equal(result.stdout, '', value)
    assert.match(result.stderr, /--min-score/)
  }
})

test('missing option values cannot select another diagnosis or swallow flags', () => {
  for (const args of [['--profile'], ['--profile', '--json'], ['--path'], ['--path', '--json'], ['--min-score']]) {
    const result = run(args)
    assert.equal(result.status, 2, args.join(' '))
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /requires a value/)
  }
})

test('missing config value never falls back to automatic config discovery', () => {
  for (const args of [['--config'], ['--config', '--json']]) {
    const result = run(args)
    assert.equal(result.status, 2)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /--config requires a value/)
  }
})

test('unknown profiles fail before accessing a target', () => {
  const result = run(['--profile', 'not-a-profile'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /--profile/)
})

test('valid boundary thresholds preserve score failure semantics', () => {
  for (const value of ['0', '100']) {
    const result = run(['--min-score', value, '--json'])
    assert.equal(result.status, 0)
    assert.equal(JSON.parse(result.stdout).score, 100)
  }
})

test('a valid threshold still fails a diagnosis below the required score', () => {
  const weakConfig = fileURLToPath(new URL('../fixtures/weak.mcp.json', import.meta.url))
  const result = spawnSync(process.execPath, [cli, '--config', weakConfig, '--min-score', '100', '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.ok(JSON.parse(result.stdout).score < 100)
  assert.equal(result.stderr, '')
})
