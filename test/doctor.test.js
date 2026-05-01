import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
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

test('optional initialize probe sends MCP initialize request', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-config-doctor-'))
  const serverPath = path.join(tempDir, 'stdio-server.js')
  const configPath = path.join(tempDir, 'mcp.json')

  fs.writeFileSync(
    serverPath,
    `
process.stdin.setEncoding('utf8')
let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  const line = buffer.split(/\\r?\\n/)[0]
  if (!line) return
  const request = JSON.parse(line)
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: request.params.protocolVersion,
      capabilities: {},
      serverInfo: { name: 'test-server', version: '1.0.0' },
    },
  }) + '\\n')
})
setTimeout(() => {}, 10000)
`,
  )

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      mcpServers: {
        probe: {
          command: process.execPath,
          args: [serverPath],
        },
      },
    }),
  )

  const report = diagnoseConfig(configPath, { initialize: true, timeoutMs: 500 })

  assert.ok(
    report.results.some(
      (result) =>
        result.check === 'probe:initialize' &&
        result.status === 'PASS' &&
        result.message.includes('2025-11-25'),
    ),
  )
})
