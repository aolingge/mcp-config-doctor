import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { diagnoseConfig, diagnoseProfile, diagnoseProfileText, redactReport, redactReportText, formatText, formatMarkdown, formatAnnotations, formatSarif } from '../src/doctor.js'

test('directory profiles redact each structured file before adding section headings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-redaction-'))
  try {
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ credentials: { one: 'synthetic-first', two: 'synthetic-second' } }, null, 2))
    fs.writeFileSync(path.join(directory, 'README.md'), 'Tools read files with narrow permissions. Document data access and risks. Start with stdio; list tools, call sample; handle error timeout.')
    for (const profile of ['permission-matrix', 'server-smoke']) {
      const report = diagnoseProfile(directory, profile)
      assert.equal(report.score, 100)
      assert.match(report.redacted, /config.json/)
      assert.doesNotMatch(JSON.stringify(redactReport(report)), /synthetic/)
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-redaction-'))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('redaction preserves valid environment template diagnosis', () => {
  const report = diagnoseProfileText('# MCP server configuration\nAPI_KEY=YOUR_API_KEY\nPORT=3000\n', '<inline>', 'env-template')
  assert.equal(report.score, 100)
  assert.doesNotMatch(report.redacted, /YOUR_API_KEY/)
})

test('cookie headers and serialized sensitive containers do not leak later entries', () => {
  for (const source of ['Cookie: session=synthetic-first; sid=synthetic-second', '{"credentials":{"one":"synthetic-first","two":"synthetic-second"}}']) {
    assert.doesNotMatch(redactReportText(source), /synthetic/)
    assert.doesNotMatch(diagnoseProfileText(source).redacted, /synthetic/)
  }
})

test('sensitive containers keep their context without mutating ordinary report data', () => {
  const source = {
    credentials: { items: ['synthetic-array-value', { value: 918273, enabled: true }] },
    authorization: 'synthetic-header-value',
    cookie: 'synthetic-cookie-value',
    private_key: ['synthetic-private-value'],
    password: 726354,
    token: null,
    api_key: '',
    score: 87,
    results: [{ status: 'WARN', check: 'secret', message: 'Secret-like value found in config' }],
  }
  const before = JSON.stringify(source)
  const result = redactReport(source)
  assert.deepEqual(result.credentials, { items: ['[REDACTED]', { value: '[REDACTED]', enabled: '[REDACTED]' }] })
  for (const key of ['authorization', 'cookie', 'password']) assert.equal(result[key], '[REDACTED]')
  assert.deepEqual(result.private_key, ['[REDACTED]'])
  assert.equal(result.token, null)
  assert.equal(result.api_key, '')
  assert.equal(result.score, 87)
  assert.deepEqual(result.results, source.results)
  assert.equal(JSON.stringify(source), before)
})

test('plaintext assignments are removed from every report format', () => {
  const message = 'API_KEY="synthetic key with spaces"; "password": "synthetic quoted value", COOKIE=synthetic-cookie; Authorization: Bearer synthetic-bearer'
  const report = { file: 'fixture.json', score: 50, results: [{ status: 'WARN', check: 'credentials', message, fix: 'Use local storage.' }] }
  const outputs = [redactReportText(message), JSON.stringify(redactReport(report)), formatText(report), formatMarkdown(report), formatAnnotations(report), JSON.stringify(formatSarif(report))]
  for (const output of outputs) {
    assert.doesNotMatch(output, /synthetic/)
    assert.match(output, /\[REDACTED\]/)
  }
  assert.equal(report.results[0].message, message)
})

test('malformed JSON never includes a parser source excerpt, through API or CLI', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-redaction-'))
  const config = path.join(directory, 'malformed.json')
  try {
    fs.writeFileSync(config, '{"mcpServers": {}, "value": synthetic-parser-marker}')
    const report = diagnoseConfig(config)
    assert.equal(report.score, 0)
    assert.equal(report.results[0].status, 'FAIL')
    assert.doesNotMatch(JSON.stringify(report), /synthetic-/)
    assert.match(report.results[0].message, /Invalid JSON syntax/)
    for (const format of [[], ['--json'], ['--markdown'], ['--annotations'], ['--sarif']]) {
      const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--config', config, ...format], { encoding: 'utf8' })
      assert.equal(cli.status, 1)
      assert.doesNotMatch(cli.stdout + cli.stderr, /synthetic-/)
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('mcp-redaction-'))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
