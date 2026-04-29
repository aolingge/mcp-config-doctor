import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseConfig } from '../src/doctor.js'

test('valid fixture scores higher than weak fixture', () => {
  const strong = diagnoseConfig('fixtures/valid.mcp.json')
  const weak = diagnoseConfig('fixtures/weak.mcp.json')
  assert.ok(strong.score > weak.score)
})

test('reports missing command and bad args', () => {
  const weak = diagnoseConfig('fixtures/weak.mcp.json')
  assert.ok(weak.results.some((result) => result.check === 'broken:args' && result.status === 'FAIL'))
  assert.ok(weak.results.some((result) => result.check === 'broken:path' && result.status === 'WARN'))
})

test('Cursor fixture captures Copilot-style schema mistakes', () => {
  const cursor = diagnoseConfig('fixtures/cursor-copilot-schema.mcp.json')
  assert.ok(cursor.results.some((result) => result.check === 'memory:args' && result.status === 'FAIL'))
})

test('Codex fixture captures redacted secrets and empty env vars', () => {
  const codex = diagnoseConfig('fixtures/codex-redacted-mistakes.mcp.json')
  assert.ok(
    codex.results.some(
      (result) => result.check === 'repo-tools:secret:GITHUB_TOKEN' && result.status === 'WARN',
    ),
  )
  assert.ok(
    codex.results.some(
      (result) => result.check === 'broken-codex-helper:env:OPENAI_API_KEY' && result.status === 'WARN',
    ),
  )
})
