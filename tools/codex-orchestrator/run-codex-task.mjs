#!/usr/bin/env node
import { readFile, rm } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'

const inputPath = process.argv[2]
if (!inputPath) {
  process.stderr.write('run-codex-task: input JSON path is required\n')
  process.exit(2)
}

const input = JSON.parse(await readFile(inputPath, 'utf8'))
const requiredString = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`)
  return value
}
const codexBin = requiredString(input.codexBin, 'codexBin')
const projectRoot = requiredString(input.projectRoot, 'projectRoot')
const message = requiredString(input.message, 'message')
const taskId = typeof input.taskId === 'string' ? input.taskId : ''
const bridgeUrl = typeof input.bridgeUrl === 'string' ? input.bridgeUrl : 'http://127.0.0.1:43122'
const sessionId = typeof input.sessionId === 'string' && input.sessionId.trim() ? input.sessionId.trim() : undefined
const cancellationPollMs = Number.isFinite(input.cancellationPollMs) ? Math.max(250, Number(input.cancellationPollMs)) : 750
const gracefulCancelMs = Number.isFinite(input.gracefulCancelMs) ? Math.max(500, Number(input.gracefulCancelMs)) : 3_000
const mcpRoleOverrides = [
  '-c', 'mcp_servers.local-creative-os.enabled=false',
  '-c', 'mcp_servers.lcos-executor.enabled=true',
]
const args = sessionId
  ? [...mcpRoleOverrides, 'exec', '--json', '--skip-git-repo-check', '-C', projectRoot, 'resume', sessionId, message]
  : [...mcpRoleOverrides, 'exec', '--json', '-C', projectRoot, '--skip-git-repo-check', message]

let stdout = ''
let stderr = ''
let cancelled = false
let settled = false
let latestTaskStatus = ''
let cancelTimer
let pollTimer

const child = spawn(codexBin, args, {
  cwd: projectRoot,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
})

const appendBounded = (current, chunk) => {
  const next = current + chunk
  return next.length > 4_000_000 ? next.slice(-4_000_000) : next
}
child.stdout.on('data', (chunk) => {
  const text = chunk.toString('utf8')
  stdout = appendBounded(stdout, text)
  process.stdout.write(text)
})
child.stderr.on('data', (chunk) => {
  const text = chunk.toString('utf8')
  stderr = appendBounded(stderr, text)
  process.stderr.write(text)
})

const killTree = () => {
  if (settled || child.pid === undefined) return
  cancelled = true
  try { child.kill('SIGINT') } catch {}
  cancelTimer = setTimeout(() => {
    if (settled || child.pid === undefined) return
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      try { process.kill(-child.pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch {} }
    }
  }, gracefulCancelMs)
}

const readTaskStatus = async ({ observeCancellation = true } = {}) => {
  if (!taskId) return ''
  try {
    const response = await fetch(new URL(`/v1/tasks/${encodeURIComponent(taskId)}`, bridgeUrl), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2_000),
    })
    if (!response.ok) return latestTaskStatus
    const body = await response.json()
    const task = body?.value?.task ?? body?.value ?? body?.task ?? body
    const status = String(task?.status ?? '').toLowerCase()
    if (status) latestTaskStatus = status
    if (observeCancellation && (status === 'cancelled' || status === 'cancelling')) killTree()
    return status
  } catch {
    return latestTaskStatus
  }
}

if (taskId) pollTimer = setInterval(() => { if (!settled) void readTaskStatus() }, cancellationPollMs)
process.on('SIGINT', killTree)
process.on('SIGTERM', killTree)

const result = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve({ code: code ?? (cancelled ? 130 : 1), signal }))
})
if (pollTimer) clearInterval(pollTimer)
await readTaskStatus({ observeCancellation: false })
settled = true
if (cancelTimer) clearTimeout(cancelTimer)
await rm(inputPath, { force: true }).catch(() => {})

const combined = `${stdout}\n${stderr}`
const patterns = [
  /"(?:session_id|sessionId|thread_id|threadId)"\s*:\s*"(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i,
  /session\s+id\s*[:=]\s*(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
]
let resolvedSessionId
for (const pattern of patterns) {
  const match = combined.match(pattern)
  if (match?.groups?.id) { resolvedSessionId = match.groups.id; break }
}
const terminalTaskStatuses = new Set(['waiting_input', 'review', 'completed', 'failed', 'cancelled', 'timeout'])
const closureObserved = !taskId || terminalTaskStatuses.has(latestTaskStatus)
const sessionInvalid = Boolean(sessionId) && /(?:session|thread).{0,80}(?:not found|does not exist|unknown|invalid|closed)|failed to (?:resume|load).{0,40}(?:session|thread)/i.test(combined)
const effectiveExitCode = cancelled
  ? 130
  : Number(result.code) !== 0
    ? Number(result.code)
    : closureObserved
      ? 0
      : 3
const failureKind = cancelled
  ? 'cancelled'
  : sessionInvalid
    ? 'session_invalid'
    : Number(result.code) !== 0
      ? 'codex_exit'
      : closureObserved
        ? null
        : 'closure_not_observed'
const payload = {
  exitCode: effectiveExitCode,
  codexExitCode: Number(result.code),
  signal: result.signal ?? null,
  cancelled,
  sessionInvalid,
  closureObserved,
  taskStatus: latestTaskStatus || null,
  failureKind,
  sessionId: resolvedSessionId ?? sessionId ?? null,
}
// codex 的孙进程（如 MCP server）可能继承 stdout 管道，导致事件循环不空、进程不退出；
// 结果写完后必须强制退出，否则会阻塞看门狗主循环。
try { child.stdout.destroy() } catch {}
try { child.stderr.destroy() } catch {}
process.stdout.write(`\nLCOS_CODEX_RESULT:${JSON.stringify(payload)}\n`, () => {
  process.exit(effectiveExitCode)
})
