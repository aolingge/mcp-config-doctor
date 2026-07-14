import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { defaultConfigCandidates, diagnoseConfig, diagnoseProfileText, PROFILE_NAMES } from '../src/doctor.js'

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

test('warns when server scope or permissions are not documented', () => {
  const weak = diagnoseConfig('fixtures/weak.mcp.json')
  const strong = diagnoseConfig('fixtures/valid.mcp.json')

  assert.ok(weak.results.some((result) => result.check === 'broken:permissions' && result.status === 'WARN'))
  assert.equal(strong.results.some((result) => result.check.endsWith(':permissions') && result.status === 'WARN'), false)
})

test('default config candidates include current supported client paths', () => {
  const win = defaultConfigCandidates('win32', 'C:\\Users\\tester')
  const mac = defaultConfigCandidates('darwin', '/Users/tester')
  const linux = defaultConfigCandidates('linux', '/home/tester')

  assert.deepEqual(win, [
    'C:\\Users\\tester\\AppData\\Roaming\\Claude\\claude_desktop_config.json',
    'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
    'C:\\Users\\tester\\.cursor\\mcp.json',
    'C:\\Users\\tester\\.codex\\mcp.json',
    'C:\\Users\\tester\\.cline\\data\\settings\\cline_mcp_settings.json',
    'C:\\Users\\tester\\.codeium\\windsurf\\mcp_config.json',
  ])

  assert.deepEqual(mac, [
    path.join('/Users/tester', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    path.join('/Users/tester', 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
    path.join('/Users/tester', '.cursor', 'mcp.json'),
    path.join('/Users/tester', '.codex', 'mcp.json'),
    path.join('/Users/tester', '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    path.join('/Users/tester', '.codeium', 'windsurf', 'mcp_config.json'),
  ])

  assert.deepEqual(linux, [
    path.join('/home/tester', '.config', 'Claude', 'claude_desktop_config.json'),
    path.join('/home/tester', '.config', 'Code', 'User', 'mcp.json'),
    path.join('/home/tester', '.cursor', 'mcp.json'),
    path.join('/home/tester', '.codex', 'mcp.json'),
    path.join('/home/tester', '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    path.join('/home/tester', '.codeium', 'windsurf', 'mcp_config.json'),
  ])
})

test('profile list includes consolidated MCP small-tool profiles', () => {
  assert.deepEqual(PROFILE_NAMES, ['config', 'manifest', 'permission-matrix', 'env-template', 'tool-name', 'server-smoke'])
})

test('manifest profile checks MCP manifest readiness', () => {
  const report = diagnoseProfileText(
    'name: filesystem\ntransport: stdio\ncommand: node server.js\npermissions: read files',
    'manifest.yml',
    'manifest',
  )
  assert.equal(report.score, 100)
})

test('permission matrix profile checks tool, permission, data, and risk signals', () => {
  const report = diagnoseProfileText(
    'Tool read_file command. Permission filesystem:read. Data includes files and secrets. Risk is documented as safe read-only.',
    'README.md',
    'permission-matrix',
  )
  assert.equal(report.score, 100)
})

test('env template profile rejects raw secret-like values', () => {
  const report = diagnoseProfileText(
    'MCP_SERVER_PORT=3000\n# API placeholder\nAPI_TOKEN=sk-1234567890abcdefghijklmnop',
    '.env.example',
    'env-template',
  )
  assert.ok(report.results.some((result) => result.check === 'no-secret' && result.status === 'FAIL'))
})

test('tool name profile checks action-oriented tool docs', () => {
  const report = diagnoseProfileText(
    'Tools: read_file, write_file, delete_file. Each tool has a description and risky delete behavior is visible.',
    'tools.md',
    'tool-name',
  )
  assert.equal(report.score, 100)
})

test('server smoke profile checks start, list, call, and failure docs', () => {
  const report = diagnoseProfileText(
    'Start with stdio run. Use tools/list for the tool list. Call invoke sample examples. Timeout error failure handling.',
    'smoke.md',
    'server-smoke',
  )
  assert.equal(report.score, 100)
})
