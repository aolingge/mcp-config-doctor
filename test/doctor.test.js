import test from 'node:test'
import assert from 'node:assert/strict'
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

test('includes common MCP client config paths', () => {
  const home = '/Users/alex'
  const cwd = '/Users/alex/project'
  const candidates = defaultConfigCandidates('darwin', home, cwd)

  assert.ok(candidates.includes('/Users/alex/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'))
  assert.ok(candidates.includes('/Users/alex/.cline/data/settings/cline_mcp_settings.json'))
  assert.ok(candidates.includes('/Users/alex/Library/Application Support/Code/User/mcp.json'))
  assert.ok(candidates.includes('/Users/alex/project/.vscode/mcp.json'))
  assert.ok(candidates.includes('/Users/alex/.codeium/windsurf/mcp_config.json'))
  assert.ok(candidates.includes('/Users/alex/.codeium/mcp_config.json'))
})

test('uses platform-specific VS Code user paths', () => {
  const windowsCandidates = defaultConfigCandidates('win32', 'C:\\Users\\Alex', 'C:\\Users\\Alex\\project')
  const linuxCandidates = defaultConfigCandidates('linux', '/home/alex', '/home/alex/project')

  assert.ok(windowsCandidates.includes('C:\\Users\\Alex\\AppData\\Roaming\\Code\\User\\mcp.json'))
  assert.ok(linuxCandidates.includes('/home/alex/.config/Code/User/mcp.json'))
})
