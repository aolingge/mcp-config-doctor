import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseConfig, formatMarkdown, redactReport, redactReportText } from '../src/doctor.js'

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

test('redacts secret-like values in JSON report data', () => {
  const openAiKey = `sk-${'a'.repeat(20)}`
  const githubToken = `ghp_${'b'.repeat(20)}`
  const report = {
    file: 'mcp.json',
    score: 50,
    env: {
      OPENAI_API_KEY: openAiKey,
      GITHUB_TOKEN: 'plain-token-value',
      PATH: '/usr/local/bin',
    },
    results: [{ status: 'WARN', check: 'secret', message: `found ${githubToken}`, fix: null }],
  }

  const redacted = redactReport(report)

  assert.equal(redacted.env.OPENAI_API_KEY, '[REDACTED]')
  assert.equal(redacted.env.GITHUB_TOKEN, '[REDACTED]')
  assert.equal(redacted.env.PATH, '/usr/local/bin')
  assert.equal(redacted.results[0].message, 'found [REDACTED]')
  assert.equal(report.env.OPENAI_API_KEY, openAiKey)
})

test('redacts secret-like values in Markdown report text', () => {
  const openAiKey = `sk-${'c'.repeat(20)}`
  const fineGrainedGithubToken = `github_pat_${'d'.repeat(20)}`
  const markdown = formatMarkdown({
    file: 'mcp.json',
    score: 50,
    results: [{ status: 'WARN', check: 'secret', message: `found ${fineGrainedGithubToken}`, fix: null }],
  })

  assert.match(markdown, /\[REDACTED\]/)
  assert.doesNotMatch(markdown, new RegExp(fineGrainedGithubToken))
  assert.equal(redactReportText(`token ${openAiKey}`), 'token [REDACTED]')
})
