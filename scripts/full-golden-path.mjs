#!/usr/bin/env node
/**
 * Slice F Golden Path — real Core + real Bridge + scripted agent + real files.
 *
 * Covers: open real project → revise (modified return, accept) →
 * analyze (zero files) → create (two new artifacts, return group) →
 * checkpoint → Core restart recovery.
 *
 * Usage: node scripts/full-golden-path.mjs
 * Requires: apps/local-core/dist built (npm run build --workspace @local-creative-os/local-core).
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'

const root = process.cwd()
const CORE_PORT = 43131
const BRIDGE_PORT = 43132
const CORE_URL = `http://127.0.0.1:${CORE_PORT}`
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`
const token = `golden-${Date.now().toString(36)}`
const evidenceRoot = mkdtempSync(join(tmpdir(), 'lcos-golden-path-'))
const dbPath = join(evidenceRoot, 'core.sqlite')
const bridgeRoot = join(evidenceRoot, 'bridge')
const projectRoot = join(evidenceRoot, 'project')
mkdirSync(bridgeRoot, { recursive: true })
mkdirSync(projectRoot, { recursive: true })

writeFileSync(join(projectRoot, 'brief.md'), '# Brief\n\n为品牌 X 制作一条 30 秒口播广告，突出「轻、快、稳」。\n')
writeFileSync(join(projectRoot, 'script.md'), '# 脚本\n\n画面 1：产品特写。\n画面 2：用户故事。\n结尾：品牌标语。\n')

const children = []

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    windowsHide: true,
  })
  children.push(child)
  return child
}

function stopAll() {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`)
    stopAll()
    process.exit(1)
  }
}

async function waitHealth(url, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // keep polling
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 350))
  }
  return false
}

async function coreRequest(path, init = {}) {
  const response = await fetch(`${CORE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const value = await response.json().catch(() => null)
  if (!response.ok || value?.ok === false) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${JSON.stringify(value)}`)
  }
  return value?.value ?? value
}

async function bridgeRequest(path, init = {}) {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  const value = await response.json().catch(() => null)
  if (!response.ok || value?.ok === false) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${JSON.stringify(value)}`)
  }
  return value?.value ?? value
}

function post(url, body) {
  return coreRequest(url, { method: 'POST', body: JSON.stringify(body) })
}

async function claimStartSubmit(lcosRunId, { prepare, changedFiles, summary }) {
  const claimed = await bridgeRequest('/v1/tasks/claim-next', {
    method: 'POST',
    body: JSON.stringify({ provider: 'workbuddy', workerId: 'golden-agent' }),
  })
  const task = claimed.task
  assert(task !== null && task !== undefined, `agent could not claim a task for run ${lcosRunId}`)
  const taskId = task.task_id ?? task.taskId
  const taskRunId = task.lcos_run_id ?? task.lcosRunId
  assert(String(taskRunId) === String(lcosRunId), `claimed task belongs to ${taskRunId}, expected ${lcosRunId}`)
  console.log(`  agent: claimed ${taskId}`)
  await bridgeRequest(`/v1/tasks/${encodeURIComponent(taskId)}/running`, {
    method: 'POST',
    body: JSON.stringify({ workerId: 'golden-agent' }),
  })
  console.log('  agent: started')
  // 新语义：run.started 在 canonical 状态进入 running 时发出。
  // 真实链路由 Runtime Auto-Sync（10s 轮询）观察到 running；脚本在此显式同步一次。
  await coreRequest(`/runs/${encodeURIComponent(lcosRunId)}/sync`, { method: 'POST' })
  const files = await prepare(task)
  console.log(`  agent: prepared ${files.length} file(s)`)
  const effectiveChanged = files.length > 0 ? files : changedFiles
  await bridgeRequest(`/v1/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'POST',
    body: JSON.stringify({
      contractVersion: 'bridge-result-v1',
      taskId,
      lcosRunId,
      providerStatus: 'review',
      summary,
      changedFiles: effectiveChanged,
    }),
  })
  console.log('  agent: submitted')
  return { taskId, files }
}

function writeExpectedOutput(task, content) {
  const expected = task.envelope?.expectedOutputs?.[0]
  const outputPath = expected?.absolutePath ?? join(task.envelope?.outputRoot, `script-draft.md`)
  writeFileSync(outputPath, content, 'utf8')
  return outputPath
}

async function main() {
  const pythonCandidates = process.platform === 'win32'
    ? [
        join(root, 'tools/light-bridge-kernel/.venv/Scripts/python.exe'),
        join(root, 'tools/light-bridge-kernel/.codex-runtime/bridge-test-venv/Scripts/python.exe'),
      ]
    : [join(root, 'tools/light-bridge-kernel/.venv/bin/python')]
  const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON ?? pythonCandidates.find((candidate) => existsSync(candidate)) ?? 'python3'
  const bridgeSource = join(root, 'tools/light-bridge-kernel/src')

  start(python, ['-m', 'lcos_bridge', 'serve', '--host', '127.0.0.1', '--port', String(BRIDGE_PORT)], {
    LCOS_BRIDGE_RUNTIME_ROOT: bridgeRoot,
    PYTHONPATH: [bridgeSource, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
  })
  assert(await waitHealth(`${BRIDGE_URL}/health`), 'Light Bridge did not start')
  console.log(`✓ Bridge ${BRIDGE_PORT}`)

  const coreEnv = {
    LOCAL_CORE_DB_PATH: dbPath,
    LOCAL_CORE_API_TOKEN: token,
    LOCAL_CORE_DISABLE_MVP_SAMPLE: '1',
    LOCAL_CORE_TEST_PORT: String(CORE_PORT),
    // 关键：dispatch 的任务必须进本脚本自起的 Bridge（43132），而不是默认 43122。
    // 缺这个字段时 Core 把任务发到 43122，脚本在 43132 claim 永远拿不到 → claim-next 返回 null。
    LCOS_BRIDGE_URL: BRIDGE_URL,
  }
  const spawnCore = () => start(process.execPath, ['apps/local-core/dist/index.js'], coreEnv)
  spawnCore()
  assert(await waitHealth(`${CORE_URL}/health`), 'Local Core did not start')
  console.log(`✓ Core ${CORE_PORT}`)

  // 1. Open a real project with real files
  const project = await post('/projects', {
    name: 'golden-path-probe',
    intent: 'open',
    rootPath: projectRoot,
    importExisting: true,
  })
  const projectId = project.id
  console.log('step: project open')
  let graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`)
  const scriptArtifact = graph.artifacts.find((item) => item.title.toLowerCase().includes('script'))
  assert(scriptArtifact !== undefined, 'script artifact was not imported')
  const scriptView = graph.artifactViews.find((view) => String(view.artifactId) === String(scriptArtifact.id))
  console.log(`✓ Project ${projectId} · script=${scriptArtifact.id}`)

  // 2. Revise: one modified output → accept
  const reviseRun = await post(`/projects/${encodeURIComponent(projectId)}/runs`, {
    instruction: '在脚本结尾补一句明确的行动号召。',
    outputIntent: 'revise',
    targetArtifactId: String(scriptArtifact.id),
  })
  const reviseRunId = reviseRun.review.run.id
  console.log(`step: revise create ${reviseRunId}`)
  await post(`/runs/${encodeURIComponent(reviseRunId)}/dispatch`, {})
  console.log('step: revise dispatch')
  const reviseEvidence = await claimStartSubmit(reviseRunId, {
    prepare: async (task) => [{
      path: writeExpectedOutput(task, '# 脚本\n\n画面 1：产品特写。\n画面 2：用户故事。\n结尾：现在就试试 X，感受轻快稳。\n'),
      action: 'modified',
    }],
    changedFiles: [],
    summary: '已在结尾补充行动号召。',
  })
  console.log('step: revise submitted')
  await post(`/runs/${encodeURIComponent(reviseRunId)}/sync`, {})
  console.log('step: revise synced')
  let review = await coreRequest(`/runs/${encodeURIComponent(reviseRunId)}/review`)
  assert(review.returns.length === 1 && review.returns[0].status === 'pending_review', 'revise return is not pending review')
  const reviseReturn = review.returns[0]
  const accepted = await post(`/artifact-returns/${encodeURIComponent(reviseReturn.id)}/accept`, {
    expectedBaseRevisionId: String(reviseReturn.baseRevisionId),
  })
  console.log('step: revise accepted')
  assert(accepted.currentRevision.status === 'current' && accepted.run.status === 'completed', 'revise accept did not complete the run')
  const reviseEvents = await coreRequest(`/runs/${encodeURIComponent(reviseRunId)}/events`)
  const reviseEventTypes = reviseEvents.map((event) => event.type)
  assert(['run.queued', 'run.started', 'run.review_ready', 'run.completed'].every((type) => reviseEventTypes.includes(type)),
    `revise event chain is incomplete: ${reviseEventTypes.join(',')}`)
  console.log(`✓ revise run=${reviseRunId} → accepted revision=${accepted.currentRevision.id}`)

  // 3. Analyze: zero files
  const analyzeRun = await post(`/projects/${encodeURIComponent(projectId)}/runs`, {
    instruction: '分析脚本的节奏问题并给出三点建议。',
    outputIntent: 'analyze',
  })
  const analyzeRunId = analyzeRun.review.run.id
  console.log(`step: analyze create ${analyzeRunId}`)
  await post(`/runs/${encodeURIComponent(analyzeRunId)}/dispatch`, {})
  console.log('step: analyze dispatch')
  await claimStartSubmit(analyzeRunId, {
    prepare: async () => [],
    changedFiles: [],
    summary: '节奏分析：1) 开场信息密度高；2) 中段缺少停顿；3) 结尾需要行动号召。',
  })
  console.log('step: analyze submitted')
  await post(`/runs/${encodeURIComponent(analyzeRunId)}/sync`, {})
  console.log('step: analyze synced')
  review = await coreRequest(`/runs/${encodeURIComponent(analyzeRunId)}/review`)
  assert(review.run.status === 'completed', 'analyze run did not complete')
  assert(review.returns.length === 0, 'analyze must not produce returns')
  console.log(`✓ analyze run=${analyzeRunId} → completed, zero returns`)

  // 4. Create: two new artifacts → return group
  const createRun = await post(`/projects/${encodeURIComponent(projectId)}/runs`, {
    instruction: '创建 shot list 与 storyboard JSON 两个新文件。',
    outputIntent: 'create',
  })
  const createRunId = createRun.review.run.id
  console.log(`step: create run ${createRunId}`)
  await post(`/runs/${encodeURIComponent(createRunId)}/dispatch`, {})
  console.log('step: create dispatch')
  const createEvidence = await claimStartSubmit(createRunId, {
    prepare: async (task) => {
      const outputRoot = task.envelope?.outputRoot
      const shotList = join(outputRoot, 'shot-list.md')
      const storyboard = join(outputRoot, 'storyboard.json')
      writeFileSync(shotList, '# Shot List\n\n1. 产品特写\n2. 用户故事\n3. 品牌标语\n', 'utf8')
      writeFileSync(storyboard, JSON.stringify({ scenes: [{ id: 1, shot: 'close-up' }, { id: 2, shot: 'story' }, { id: 3, shot: 'logo' }] }, null, 2), 'utf8')
      return [
        { path: shotList, action: 'created' },
        { path: storyboard, action: 'created' },
      ]
    },
    changedFiles: [],
    summary: '已创建 shot list 与 storyboard 两个新文件。',
  })
  console.log('step: create submitted')
  await post(`/runs/${encodeURIComponent(createRunId)}/sync`, {})
  console.log('step: create synced')
  review = await coreRequest(`/runs/${encodeURIComponent(createRunId)}/review`)
  assert(review.returns.length === 2 && review.returns.every((item) => item.status === 'pending_review'), 'create return group is not pending')
  const firstCreated = await post(`/artifact-returns/${encodeURIComponent(review.returns[0].id)}/accept`, {
    expectedBaseRevisionId: String(review.returns[0].baseRevisionId),
  })
  console.log('step: create accepted')
  assert(firstCreated.run.status === 'completed' && firstCreated.currentRevision.status === 'current', 'create accept failed')
  console.log(`✓ create run=${createRunId} → 2 returns, 1 accepted`)

  // 4b. Cancel: bound run cancelled before the agent claims it
  const cancelRun = await post(`/projects/${encodeURIComponent(projectId)}/runs`, {
    instruction: '这次不需要执行，立即取消。',
    outputIntent: 'revise',
    targetArtifactId: String(scriptArtifact.id),
  })
  const cancelRunId = cancelRun.review.run.id
  await post(`/runs/${encodeURIComponent(cancelRunId)}/dispatch`, {})
  const cancelledReview = await post(`/runs/${encodeURIComponent(cancelRunId)}/cancel`, {})
  assert(cancelledReview.review.run.status === 'cancelled', 'cancel did not cancel the bound Run')
  const cancelEvents = await coreRequest(`/runs/${encodeURIComponent(cancelRunId)}/events`)
  assert(cancelEvents.some((event) => event.type === 'run.cancelled'), 'run.cancelled event missing')
  console.log(`✓ cancel run=${cancelRunId} → cancelled with event`)

  // 4c. Codex provider loop: claim-by-id + start + submit + sync
  const codexRun = await post(`/projects/${encodeURIComponent(projectId)}/runs`, {
    instruction: '用 Codex 分析一次节奏问题。',
    outputIntent: 'analyze',
    requestedProvider: 'codex',
  })
  const codexRunId = codexRun.review.run.id
  await post(`/runs/${encodeURIComponent(codexRunId)}/dispatch`, {})
  const codexTaskResponse = await bridgeRequest(`/v1/tasks/by-run/${encodeURIComponent(codexRunId)}`)
  const codexTask = codexTaskResponse.task ?? codexTaskResponse
  const codexTaskId = codexTask.taskId ?? codexTask.task_id
  assert(codexTaskId !== undefined, 'codex task was not created')
  assert(String(codexTask.provider).toLowerCase() === 'codex', 'codex task provider mismatch')
  const codexClaimed = await bridgeRequest(`/v1/tasks/${encodeURIComponent(codexTaskId)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ provider: 'codex', workerId: 'codex-agent' }),
  })
  const codexClaimTask = codexClaimed.task ?? codexClaimed
  assert(['claimed', 'running'].includes(String(codexClaimTask.status)), 'codex claim-by-id failed')
  await bridgeRequest(`/v1/tasks/${encodeURIComponent(codexTaskId)}/running`, {
    method: 'POST',
    body: JSON.stringify({ workerId: 'codex-agent' }),
  })
  await bridgeRequest(`/v1/tasks/${encodeURIComponent(codexTaskId)}/result`, {
    method: 'POST',
    body: JSON.stringify({
      contractVersion: 'bridge-result-v1',
      taskId: codexTaskId,
      lcosRunId: codexRunId,
      providerStatus: 'review',
      summary: 'Codex 分析完成：节奏三段。',
      changedFiles: [],
    }),
  })
  await post(`/runs/${encodeURIComponent(codexRunId)}/sync`, {})
  const codexReview = await coreRequest(`/runs/${encodeURIComponent(codexRunId)}/review`)
  assert(codexReview.run.status === 'completed', 'codex run did not complete')
  console.log(`✓ codex analyze run=${codexRunId} → completed via claim-by-id`)

  // 5. Checkpoint
  console.log('step: checkpoint')
  graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`)
  const checkpoint = await post(`/projects/${encodeURIComponent(projectId)}/checkpoints`, {
    id: `checkpoint-golden-1`,
    projectId,
    scopeId: String(graph.scopes[0].id),
    label: 'Golden Path 手动检查点',
    snapshotJson: graph,
    createdAt: new Date().toISOString(),
  })
  assert(checkpoint.id === 'checkpoint-golden-1', 'checkpoint was not persisted')
  console.log(`✓ checkpoint ${checkpoint.id}`)

  // 6. Core restart recovery
  console.log('step: kill core')
  const coreChild = children[children.length - 1]
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(coreChild.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
  } else {
    coreChild.kill('SIGTERM')
  }
  console.log('step: wait core down')
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_500))
  assert(!(await waitHealth(`${CORE_URL}/health`, 3_000)), 'core should be down after kill')
  console.log('step: respawn core')
  spawnCore()
  console.log('step: wait core up')
  assert(await waitHealth(`${CORE_URL}/health`), 'core did not recover after restart')
  console.log('step: verify recovery')
  const afterRestart = await coreRequest(`/runs/${encodeURIComponent(reviseRunId)}/review`)
  assert(afterRestart.run.status === 'completed', 'accepted run state lost after restart')
  const checkpoints = await coreRequest(`/projects/${encodeURIComponent(projectId)}/checkpoints`)
  assert(checkpoints.some((item) => item.id === 'checkpoint-golden-1'), 'checkpoint lost after restart')
  graph = await coreRequest(`/projects/${encodeURIComponent(projectId)}/graph`)
  const scriptAfter = graph.artifacts.find((item) => item.id === scriptArtifact.id)
  assert(scriptAfter.currentRevisionId === accepted.currentRevision.id, 'accepted revision pointer lost after restart')
  console.log(`✓ restart recovery: run completed + checkpoint + current revision intact`)

  console.log('\n=== GOLDEN PATH PASS ===')
  console.log(JSON.stringify({
    projectId,
    revise: { runId: reviseRunId, returnId: reviseReturn.id, acceptedRevisionId: accepted.currentRevision.id },
    analyze: { runId: analyzeRunId },
    create: { runId: createRunId, returns: review.returns.length, createdFiles: createEvidence.files.map((item) => item.path) },
    cancel: { runId: cancelRunId },
    codex: { runId: codexRunId },
    checkpoint: checkpoint.id,
    evidenceRoot,
  }, null, 2))
  stopAll()
  rmSync(evidenceRoot, { recursive: true, force: true })
}

main().catch((error) => {
  console.error(`✗ FAIL: ${error instanceof Error ? error.message : String(error)}`)
  stopAll()
  process.exit(1)
})
