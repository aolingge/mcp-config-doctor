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

test('includes common client config candidates', () => {
  const home = '/home/alice'
  const linux = defaultConfigCandidates('linux', home)

  assert.ok(linux.includes(path.join(home, '.config', 'Code', 'User', 'mcp.json')))
  assert.ok(linux.includes(path.join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json')))
  assert.ok(linux.includes(path.join(home, '.codeium', 'windsurf', 'mcp_config.json')))
})

test('uses platform-specific VS Code user MCP paths', () => {
  const home = '/Users/alice'

  assert.ok(defaultConfigCandidates('darwin', home).includes(path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json')))
  assert.ok(defaultConfigCandidates('win32', home).includes(path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json')))
})
