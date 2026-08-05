#!/usr/bin/env node
// Diagnostic: spawn an MCP server command (stdio) and perform initialize + tools/list.
// Usage: node scripts/probe-mcp-server.mjs "<command>" [arg...]
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const [command, ...args] = process.argv.slice(2)
if (!command) {
  process.stderr.write('Usage: node scripts/probe-mcp-server.mjs "<command>" [arg...]\n')
  process.exit(2)
}

const child = spawn(command, args, {
  cwd: resolve(import.meta.dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
  shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  env: {
    ...process.env,
    LCOS_MCP_ROLE: args.some((arg) => arg.includes('executor')) ? 'executor' : 'agent',
  },
})

let buffer = ''
let nextId = 0
const pending = new Map()

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8')
  let boundary
  while ((boundary = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, boundary).trim()
    buffer = buffer.slice(boundary + 1)
    if (!line) continue
    let message
    try { message = JSON.parse(line) } catch { continue }
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
})

let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })

function request(method, params = {}) {
  return new Promise((resolvePromise) => {
    const id = ++nextId
    pending.set(id, resolvePromise)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
}

const start = Date.now()
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('MCP initialize timeout')), 8000))
let initialized
try {
  initialized = await Promise.race([
    request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'lcos-probe', version: '1.0.0' },
    }),
    timeout,
  ])
} catch (error) {
  process.stdout.write(JSON.stringify({
    command,
    ok: false,
    error: error.message,
    stderr: stderr.trim().slice(0, 1000),
  }, null, 2))
  child.kill()
  process.exit(1)
}
await request('notifications/initialized', {})
const tools = await request('tools/list', {})
const elapsed = Date.now() - start

const toolNames = Array.isArray(tools.result?.tools) ? tools.result.tools.map((tool) => tool.name) : []
process.stdout.write(JSON.stringify({
  command,
  ok: !initialized.error && !tools.error,
  elapsedMs: elapsed,
  initializedProtocol: initialized.result?.protocolVersion ?? null,
  toolCount: toolNames.length,
  toolNames: toolNames.slice(0, 20),
  stderr: stderr.trim().slice(0, 500),
}, null, 2))
child.kill()
process.exit(0)
