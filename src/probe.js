import { spawn } from 'node:child_process'

const modernVersion = '2026-07-28'
const legacyVersions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const outputLimit = 64 * 1024
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const outcome = (status, message) => ({ status, message, fix: status === 'PASS' ? null : 'Inspect the server locally; no server output is included in this report.' })

function requestFor(mode) {
  const clientInfo = { name: 'mcp-config-doctor', version: '0.1.1' }
  return mode === 'discover'
    ? { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: {
      'io.modelcontextprotocol/protocolVersion': modernVersion,
      'io.modelcontextprotocol/clientInfo': clientInfo,
      'io.modelcontextprotocol/clientCapabilities': {},
    } } }
    : { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: legacyVersions[0], capabilities: {}, clientInfo } }
}

function validResult(result, mode) {
  if (!record(result) || !record(result.capabilities)) return false
  if (mode === 'discover') {
    return result.resultType === 'complete' && Array.isArray(result.supportedVersions)
      && result.supportedVersions.every((value) => typeof value === 'string')
      && result.supportedVersions.includes(modernVersion)
  }
  return legacyVersions.includes(result.protocolVersion) && record(result.serverInfo)
    && typeof result.serverInfo.name === 'string' && result.serverInfo.name.length > 0
    && typeof result.serverInfo.version === 'string' && result.serverInfo.version.length > 0
}

export function validateProbeOptions(options = {}) {
  const modes = ['start', 'initialize', 'discover'].filter((name) => options[name] === true)
  if (modes.length > 1) throw new Error('Choose only one of --start, --initialize or --discover')
  const timeout = options.timeoutMs ?? 2500
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) {
    throw new Error('--timeout-ms must be an integer from 100 to 60000')
  }
  return timeout
}

// This bounds and reaps the direct child. It is not a sandbox for commands or
// their descendants, and deliberately does not retain stdout/stderr in reports.
export function runProtocolProbe(server, env, mode, timeoutMs = 2500) {
  validateProbeOptions({ [mode]: true, timeoutMs })
  if (!['initialize', 'discover'].includes(mode)) throw new Error('Unknown protocol probe mode')
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(server.command, server.args ?? [], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    } catch {
      resolve(outcome('WARN', 'Protocol probe could not start the process'))
      return
    }
    let pending = null
    let completed = false
    let bytes = 0
    let buffer = ''
    let killTimer
    let cleanupTimer
    const deadline = setTimeout(() => stop(outcome('WARN', 'No matching protocol response before timeout')), timeoutMs)
    function finish(result = pending) {
      if (completed) return
      completed = true
      clearTimeout(deadline)
      clearTimeout(killTimer)
      clearTimeout(cleanupTimer)
      resolve(result)
    }
    function stop(result) {
      if (pending || completed) return
      pending = result
      clearTimeout(deadline)
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      if (child.exitCode !== null || child.signalCode !== null) { finish(); return }
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 200)
      cleanupTimer = setTimeout(() => finish(outcome('WARN', 'Protocol probe could not confirm direct-child cleanup')), 500)
    }
    function count(chunk) {
      bytes += chunk.length
      if (bytes > outputLimit) {
        stop(outcome('FAIL', 'Protocol probe exceeded the 64 KiB output limit'))
        return false
      }
      return !pending && !completed
    }
    child.once('error', () => stop(outcome('WARN', 'Protocol probe could not start the process')))
    child.once('close', () => {
      if (!pending) pending = outcome('WARN', 'Process exited before a matching protocol response')
      finish()
    })
    child.stdin.on('error', () => stop(outcome('WARN', 'Protocol probe could not write its request')))
    child.stderr.on('data', count)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      if (!count(Buffer.from(chunk))) return
      buffer += chunk
      while (!pending && buffer.includes('\n')) {
        const end = buffer.indexOf('\n')
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        if (!line) continue
        let message
        try { message = JSON.parse(line) } catch {
          stop(outcome('FAIL', 'Protocol probe received a malformed JSON frame')); break
        }
        if (!record(message) || message.jsonrpc !== '2.0') {
          stop(outcome('FAIL', 'Protocol probe received an invalid JSON-RPC envelope')); break
        }
        const hasResult = Object.hasOwn(message, 'result')
        const hasError = Object.hasOwn(message, 'error')
        if (Object.hasOwn(message, 'method')) {
          if (typeof message.method !== 'string' || hasResult || hasError) {
            stop(outcome('FAIL', 'Protocol probe received an invalid request envelope')); break
          }
          // Request IDs belong to each direction independently. A server ping
          // can legally use the same ID as our outstanding initialize request.
          if (!Object.hasOwn(message, 'id') || mode === 'discover') continue
          if (!(typeof message.id === 'string' || Number.isInteger(message.id))) {
            stop(outcome('FAIL', 'Protocol probe received an invalid request id')); break
          }
          if (message.method !== 'ping') {
            stop(outcome('FAIL', 'Protocol probe received an unsupported server request')); break
          }
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} }) + '\n')
          continue
        }
        if (message.id !== 1) continue
        if (hasResult === hasError) {
          stop(outcome('FAIL', 'Protocol probe received an invalid response envelope')); break
        }
        if (hasError) {
          stop(outcome('FAIL', 'Server returned a protocol error')); break
        }
        if (!validResult(message.result, mode)) {
          stop(outcome('FAIL', 'Server returned an incompatible or malformed protocol result')); break
        }
        const passed = outcome('PASS', mode === 'discover'
          ? 'MCP server/discover response supports 2026-07-28'
          : `MCP initialize response accepted (${message.result.protocolVersion})`)
        if (mode === 'initialize') {
          // Flush the final notification before closing the direct child.
          child.stdin.end(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n', () => stop(passed))
          break
        }
        stop(passed)
      }
    })
    child.stdin.write(JSON.stringify(requestFor(mode)) + '\n')
  })
}
