import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import readline from 'node:readline'

const root = process.cwd()
const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
if (!python) {
  throw new Error('LCOS_LIGHT_BRIDGE_PYTHON must point to a Python environment that can run Light Bridge.')
}

const evidenceRoot = await mkdtemp(join(tmpdir(), 'lcos-mcp-bridge-e2e-'))
const runtimeRoot = join(evidenceRoot, 'bridge-runtime')
const outputRoot = join(evidenceRoot, 'outputs')
const inputPackPath = join(evidenceRoot, 'runtime-input-pack.json')
const bridgePort = Number(process.env.LCOS_MCP_E2E_BRIDGE_PORT ?? 43124)
const bridgeBase = `http://127.0.0.1:${bridgePort}`
const sourceRoot = resolve(root, 'tools/light-bridge-kernel/src')
await Promise.all([mkdir(runtimeRoot), mkdir(outputRoot)])
await writeFile(inputPackPath, JSON.stringify({ schemaVersion: 1, runId: 'run-mcp-e2e' }), 'utf8')

const children = new Set()

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

async function stop(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3_000)),
  ])
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const value = await response.json()
  if (!response.ok || value.ok === false) {
    throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${JSON.stringify(value)}`)
  }
  return value
}

async function waitForHealth() {
  let lastError
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await requestJson(`${bridgeBase}/health`)
    } catch (error) {
      lastError = error
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
  }
  throw lastError
}

function post(url, body) {
  return requestJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createMcpClient(child) {
  const pending = new Map()
  let id = 0
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
  lines.on('line', (line) => {
    const message = JSON.parse(line)
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  })
  return {
    call(method, params = {}) {
      id += 1
      const requestId = id
      const response = new Promise((resolveResponse, rejectResponse) => {
        pending.set(requestId, { resolve: resolveResponse, reject: rejectResponse })
      })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`)
      return response
    },
  }
}

let bridge
let mcp
try {
  bridge = start(python, [
    '-m', 'lcos_bridge', 'serve',
    '--runtime-root', runtimeRoot,
    '--host', '127.0.0.1',
    '--port', String(bridgePort),
  ], {
    PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
  })
  let bridgeError = ''
  bridge.stderr.on('data', (chunk) => { bridgeError += chunk.toString() })
  const health = await waitForHealth()

  const taskCreated = await post(`${bridgeBase}/v1/tasks`, {
    contractVersion: 'bridge-task-v1',
    lcosRunId: 'run-mcp-e2e',
    idempotencyKey: 'run-mcp-e2e',
    requestFingerprint: 'a'.repeat(64),
    manifestId: 'manifest-mcp-e2e',
    manifestHash: 'b'.repeat(64),
    outputIntent: 'analyze',
    instructions: 'Return a structured MCP E2E analysis without changing files.',
    provider: 'workbuddy',
    taskType: 'creative_run',
    runtimeInputPackPath: inputPackPath,
    outputRoot,
    expectedOutputs: [],
    outputPolicy: {
      allowZeroFiles: true,
      allowAdditionalFiles: false,
      maxFiles: 1,
    },
    timeoutSeconds: 120,
    reportMode: 'short',
    metadata: { test: 'lcos-mcp-bridge-e2e' },
  })
  const taskId = taskCreated.task.taskId

  mcp = start(process.execPath, [resolve(root, 'tools/lcos-agent/mcp-server.mjs')], {
    LCOS_BRIDGE_URL: bridgeBase,
  })
  let mcpError = ''
  mcp.stderr.on('data', (chunk) => { mcpError += chunk.toString() })
  const client = createMcpClient(mcp)
  await client.call('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'lcos-mcp-e2e', version: '1.0.0' },
  })

  const claimed = await client.call('tools/call', {
    name: 'claim_lcos_task',
    arguments: { provider: 'workbuddy', worker_id: 'mcp-e2e-worker' },
  })
  if (claimed.structuredContent.task?.taskId !== taskId) throw new Error('MCP claimed an unexpected task.')

  const started = await client.call('tools/call', {
    name: 'start_lcos_task',
    arguments: { task_id: taskId, worker_id: 'mcp-e2e-worker' },
  })
  if (started.structuredContent.task?.status !== 'running') throw new Error('MCP did not start the task.')

  const submitted = await client.call('tools/call', {
    name: 'submit_lcos_result',
    arguments: {
      task_id: taskId,
      result: {
        contractVersion: 'bridge-result-v1',
        taskId,
        lcosRunId: 'run-mcp-e2e',
        providerStatus: 'review',
        summary: 'LCOS MCP completed the real pull lifecycle.',
        changedFiles: [],
        warnings: [],
        suggestedNextActions: ['verify_mcp_result'],
      },
    },
  })
  if (submitted.structuredContent.task?.providerStatus !== 'review') {
    throw new Error('MCP result did not reach provider review.')
  }

  const fetched = await client.call('tools/call', {
    name: 'get_lcos_task',
    arguments: { task_id: taskId },
  })
  const byRun = await client.call('tools/call', {
    name: 'get_lcos_task_by_run',
    arguments: { lcos_run_id: 'run-mcp-e2e' },
  })
  if (fetched.structuredContent.task?.taskId !== taskId || byRun.structuredContent.task?.taskId !== taskId) {
    throw new Error('MCP task lookup did not preserve task identity.')
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    bridgeVersion: health.bridgeVersion,
    taskId,
    lcosRunId: 'run-mcp-e2e',
    claimedStatus: claimed.structuredContent.task.status,
    startedStatus: started.structuredContent.task.status,
    providerStatus: submitted.structuredContent.task.providerStatus,
    fetchedTaskId: fetched.structuredContent.task.taskId,
    byRunTaskId: byRun.structuredContent.task.taskId,
    evidenceRoot,
    bridgeError: bridgeError.trim() || undefined,
    mcpError: mcpError.trim() || undefined,
  }, null, 2)}\n`)
} finally {
  await Promise.all([...children].map(stop))
}
