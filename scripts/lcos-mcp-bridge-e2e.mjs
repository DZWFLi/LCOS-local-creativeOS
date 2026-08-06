import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import readline from 'node:readline'

const root = process.cwd()
const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
if (!python) throw new Error('LCOS_LIGHT_BRIDGE_PYTHON must point to a Python environment that can run Light Bridge.')
const coreEntry = resolve(root, 'apps/local-core/dist/index.js')
if (!existsSync(coreEntry)) throw new Error('Local Core is not built. Run npm run build:local-core first.')

const evidenceRoot = await mkdtemp(join(tmpdir(), 'lcos-mcp-split-e2e-'))
const runtimeRoot = join(evidenceRoot, 'bridge-runtime')
const outputRoot = join(evidenceRoot, 'outputs')
const inputPackPath = join(evidenceRoot, 'runtime-input-pack.json')
const databasePath = join(evidenceRoot, 'local-core.sqlite')
const bridgePort = Number(process.env.LCOS_MCP_E2E_BRIDGE_PORT ?? 43134)
const corePort = Number(process.env.LCOS_MCP_E2E_CORE_PORT ?? 43135)
const bridgeBase = `http://127.0.0.1:${bridgePort}`
const coreBase = `http://127.0.0.1:${corePort}`
const token = `mcp-e2e-${Date.now()}`
const sourceRoot = resolve(root, 'tools/light-bridge-kernel/src')
await Promise.all([mkdir(runtimeRoot), mkdir(outputRoot)])
await writeFile(inputPackPath, JSON.stringify({ schemaVersion: 1, runId: 'run-mcp-split-e2e' }), 'utf8')

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
  if (child.exitCode === null) child.kill('SIGKILL')
}
async function requestJson(url, init = {}) {
  const response = await fetch(url, init)
  const value = await response.json().catch(() => ({}))
  if (!response.ok || value.ok === false) throw new Error(`${init.method ?? 'GET'} ${url} failed: ${JSON.stringify(value)}`)
  return value
}
async function waitFor(url, init = {}) {
  let lastError
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { return await requestJson(url, init) }
    catch (error) { lastError = error; await new Promise((resolveWait) => setTimeout(resolveWait, 125)) }
  }
  throw lastError
}
function bridgePost(path, body) {
  return requestJson(`${bridgeBase}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}
function createMcpClient(child) {
  const pending = new Map()
  let id = 0
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
  lines.on('line', (line) => {
    let message
    try { message = JSON.parse(line) } catch { return }
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
      return new Promise((resolveResponse, rejectResponse) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId)
          rejectResponse(new Error(`MCP ${method} timed out.`))
        }, 10_000)
        pending.set(requestId, {
          resolve: (value) => { clearTimeout(timeout); resolveResponse(value) },
          reject: (error) => { clearTimeout(timeout); rejectResponse(error) },
        })
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`)
      })
    },
  }
}
async function initializeMcp(role) {
  const child = start(process.execPath, [resolve(root, 'tools/lcos-agent/mcp-server.mjs')], {
    LCOS_MCP_ROLE: role,
    LCOS_CORE_URL: coreBase,
    LOCAL_CORE_API_TOKEN: token,
  })
  let error = ''
  child.stderr.on('data', (chunk) => { error += chunk.toString() })
  const client = createMcpClient(child)
  const initialized = await client.call('initialize', {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'lcos-mcp-split-e2e', version: '1.0.0' },
  })
  return { child, client, initialized, error: () => error }
}

let bridge
let core
let agent
let executor
let bridgeError = ''
let coreError = ''
try {
  bridge = start(python, [
    '-m', 'lcos_bridge', 'serve', '--runtime-root', runtimeRoot, '--host', '127.0.0.1', '--port', String(bridgePort),
  ], { PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(delimiter) })
  bridge.stderr.on('data', (chunk) => { bridgeError += chunk.toString() })
  const health = await waitFor(`${bridgeBase}/health`)

  core = start(process.execPath, [coreEntry], {
    LOCAL_CORE_TEST_PORT: String(corePort),
    LOCAL_CORE_DB_PATH: databasePath,
    LOCAL_CORE_API_TOKEN: token,
    LOCAL_CORE_MVP_SAMPLE_ROOT: join(evidenceRoot, 'mvp-sample-project'),
    LCOS_BRIDGE_URL: bridgeBase,
    LCOS_AUTO_SYNC_MS: '60000',
  })
  core.stderr.on('data', (chunk) => { coreError += chunk.toString() })
  await waitFor(`${coreBase}/health`, { headers: { authorization: `Bearer ${token}` } })

  const taskCreated = await bridgePost('/v1/tasks', {
    contractVersion: 'bridge-task-v1',
    lcosRunId: 'run-mcp-split-e2e',
    idempotencyKey: 'run-mcp-split-e2e',
    requestFingerprint: 'a'.repeat(64),
    manifestId: 'manifest-mcp-split-e2e',
    manifestHash: 'b'.repeat(64),
    outputIntent: 'analyze',
    instructions: 'Return a structured executor MCP E2E analysis without changing files.',
    provider: 'codex',
    taskType: 'creative_run',
    runtimeInputPackPath: inputPackPath,
    outputRoot,
    expectedOutputs: [],
    outputPolicy: { allowZeroFiles: true, allowAdditionalFiles: false, maxFiles: 1 },
    timeoutSeconds: 120,
    reportMode: 'short',
    metadata: { test: 'lcos-mcp-split-e2e' },
  })
  const taskId = taskCreated.task.taskId

  executor = await initializeMcp('executor')
  agent = await initializeMcp('agent')
  if (executor.initialized.serverInfo?.name !== 'lcos-executor') throw new Error('Executor MCP identity mismatch.')
  if (agent.initialized.serverInfo?.name !== 'local-creative-os') throw new Error('Agent MCP identity mismatch.')

  const executorTools = await executor.client.call('tools/list')
  const agentTools = await agent.client.call('tools/list')
  if (!executorTools.tools.some((tool) => tool.name === 'claim_lcos_run')) throw new Error('Executor does not expose claim_lcos_run.')
  if (!executorTools.tools.some((tool) => tool.name === 'submit_lcos_result')) throw new Error('Executor does not expose submit_lcos_result.')
  if (agentTools.tools.some((tool) => tool.name === 'claim_lcos_run')) throw new Error('Agent MCP exposes executor tool.')
  if (!agentTools.tools.some((tool) => tool.name === 'import_lcos_conversation')) throw new Error('Agent MCP does not expose conversation import.')
  for (const toolName of ['create_lcos_relation', 'open_lcos_preview', 'select_lcos_views', 'focus_lcos_views']) {
    if (!agentTools.tools.some((tool) => tool.name === toolName)) throw new Error(`Agent MCP does not expose ${toolName}.`)
  }

  const listedProjects = await agent.client.call('tools/call', { name: 'list_lcos_projects', arguments: {} })
  const project = listedProjects.structuredContent?.[0] ?? listedProjects.structuredContent?.projects?.[0]
  if (!project?.id) throw new Error(`Agent MCP did not list the sample Project: ${JSON.stringify(listedProjects)}`)
  const projectSummaryCall = await agent.client.call('tools/call', { name: 'get_lcos_project_summary', arguments: { projectId: project.id } })
  const projectSummary = projectSummaryCall.structuredContent
  const views = projectSummary?.views ?? []
  if (views.length < 2) throw new Error('Sample Project does not have enough views for Canvas action E2E.')
  const workspaceId = projectSummary?.workspaces?.[0]?.id
  const sourceViewId = String(views[0].id)
  const targetViewId = String(views[1].id)
  const selected = await agent.client.call('tools/call', { name: 'select_lcos_views', arguments: { projectId: project.id, ...(workspaceId ? { workspaceId } : {}), viewIds: [sourceViewId, targetViewId] } })
  if (selected.isError || selected.structuredContent?.selectedViewIds?.length !== 2) throw new Error('Agent MCP selection action failed.')
  const viewport = await agent.client.call('tools/call', { name: 'focus_lcos_views', arguments: { projectId: project.id, ...(workspaceId ? { workspaceId } : {}), viewId: sourceViewId } })
  if (viewport.isError || !(viewport.structuredContent?.selectedViewIds ?? []).includes(sourceViewId)) throw new Error('Agent MCP focus action failed.')
  const relation = await agent.client.call('tools/call', { name: 'create_lcos_relation', arguments: { projectId: project.id, sourceViewId, targetViewId, kind: 'mcp_e2e_reference' } })
  if (relation.isError || relation.structuredContent?.kind !== 'mcp_e2e_reference') throw new Error('Agent MCP relation action failed.')
  const observation = await agent.client.call('tools/call', { name: 'watch_lcos_active_context', arguments: { projectId: project.id, ...(workspaceId ? { workspaceId } : {}), afterVersion: 0 } })
  if (observation.isError || !(observation.structuredContent?.version > 0)) throw new Error('Agent MCP context watch failed.')
  const preview = await agent.client.call('tools/call', { name: 'open_lcos_preview', arguments: { projectId: project.id, ...(workspaceId ? { workspaceId } : {}), viewId: sourceViewId, generate: false, includeContent: false } })
  if (preview.isError || preview.structuredContent?.viewId !== sourceViewId) throw new Error('Agent MCP preview action failed.')

  const agentToolNames = agentTools.tools.map((tool) => tool.name)
  const agentRejectedExecutor = !agentToolNames.some((name) => ['claim_lcos_run', 'claim_lcos_task', 'submit_lcos_result', 'start_lcos_task'].includes(name))
  if (!agentRejectedExecutor) throw new Error('Agent MCP did not reject executor-only tool.')

  const claimed = await executor.client.call('tools/call', {
    name: 'claim_lcos_run', arguments: { runId: 'run-mcp-split-e2e', workerId: 'mcp-split-e2e-worker' },
  })
  if (claimed.isError || claimed.structuredContent.task?.taskId !== taskId) throw new Error(`Executor claimed an unexpected task: ${JSON.stringify(claimed)}`)

  const started = await executor.client.call('tools/call', {
    name: 'start_lcos_run', arguments: { runId: 'run-mcp-split-e2e', workerId: 'mcp-split-e2e-worker' },
  })
  if (started.isError || started.structuredContent.task?.status !== 'running') throw new Error('Executor did not start the task.')

  const submitted = await executor.client.call('tools/call', {
    name: 'submit_lcos_result',
    arguments: {
      task_id: taskId,
      result: {
        contractVersion: 'bridge-result-v1', taskId, lcosRunId: 'run-mcp-split-e2e', providerStatus: 'review',
        summary: 'Split executor MCP completed the real pull lifecycle.', changedFiles: [], warnings: [], suggestedNextActions: ['verify_split_mcp'],
      },
    },
  })
  if (submitted.isError || submitted.structuredContent.task?.providerStatus !== 'review') throw new Error('Executor result did not reach provider review.')

  const fetched = await executor.client.call('tools/call', { name: 'get_lcos_task', arguments: { task_id: taskId } })
  if (fetched.structuredContent.task?.taskId !== taskId) throw new Error('Executor lookup lost task identity.')

  const mcpRoute = await fetch(`${bridgeBase}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  if (mcpRoute.status !== 404) throw new Error(`Bridge still exposes /mcp with HTTP ${mcpRoute.status}.`)

  process.stdout.write(`${JSON.stringify({
    ok: true,
    bridgeVersion: health.bridgeVersion,
    taskId,
    lcosRunId: 'run-mcp-split-e2e',
    agentToolCount: agentTools.tools.length,
    executorToolCount: executorTools.tools.length,
    agentRejectedExecutor,
    canvasActions: { selection: true, viewport: true, relation: true, observation: true, preview: true },
    claimedStatus: claimed.structuredContent.task.status,
    startedStatus: started.structuredContent.task.status,
    providerStatus: submitted.structuredContent.task.providerStatus,
    evidenceRoot,
    bridgeError: bridgeError.trim() || undefined,
    coreError: coreError.trim() || undefined,
    agentError: agent.error().trim() || undefined,
    executorError: executor.error().trim() || undefined,
  }, null, 2)}\n`)
} finally {
  await Promise.all([...children].map(stop))
}
