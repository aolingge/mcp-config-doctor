import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { defaultConfigCandidates, diagnoseConfig } from '../src/doctor.js'

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
    'C:\\Users\\tester\\.cursor\\mcp.json',
    'C:\\Users\\tester\\.codex\\mcp.json',
    'C:\\Users\\tester\\.cline\\data\\settings\\cline_mcp_settings.json',
    'C:\\Users\\tester\\.codeium\\windsurf\\mcp_config.json',
  ])

  assert.deepEqual(mac, [
    path.join('/Users/tester', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    path.join('/Users/tester', '.cursor', 'mcp.json'),
    path.join('/Users/tester', '.codex', 'mcp.json'),
    path.join('/Users/tester', '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    path.join('/Users/tester', '.codeium', 'windsurf', 'mcp_config.json'),
  ])

  assert.deepEqual(linux, [
    path.join('/home/tester', '.config', 'Claude', 'claude_desktop_config.json'),
    path.join('/home/tester', '.cursor', 'mcp.json'),
    path.join('/home/tester', '.codex', 'mcp.json'),
    path.join('/home/tester', '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    path.join('/home/tester', '.codeium', 'windsurf', 'mcp_config.json'),
  ])
})
