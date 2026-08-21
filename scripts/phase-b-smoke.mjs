/**
 * Phase B 真实 HTTP 冒烟：Project Affinity + Capture Staging。
 * 起临时 Core，建两个项目，验证确定性归属矩阵与 staging 全流程。
 */
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 43132
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'smoke-token-b'
const HEADERS = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = await response.json().catch(() => ({ ok: false }))
  return { status: response.status, json }
}

async function waitForHealth(timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1_500) })
      if (response.ok) return
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('Core did not become healthy in time.')
}

const root = await mkdtemp(join(tmpdir(), 'lcos-phase-b-smoke-'))
const core = spawn(process.execPath, ['dist/index.js'], {
  cwd: join(process.cwd(), 'apps/local-core'),
  stdio: ['ignore', 'ignore', 'ignore'],
  windowsHide: true,
  env: {
    ...process.env,
    LOCAL_CORE_DB_PATH: join(root, 'smoke.sqlite'),
    LOCAL_CORE_TEST_PORT: String(PORT),
    LOCAL_CORE_API_TOKEN: TOKEN,
    LOCAL_CORE_DISABLE_MVP_SAMPLE: '1',
    LCOS_RUNTIME_REGISTRY: join(root, 'runtime-registry.json'),
    LCOS_CAPTURE_STAGING_ROOT: join(root, 'blobs'),
  },
})

try {
  await waitForHealth()

  const rootA = join(root, 'alpha')
  const rootB = join(root, 'beta')
  await mkdir(rootA, { recursive: true })
  await mkdir(rootB, { recursive: true })
  const createdA = await call('/projects', { method: 'POST', body: { name: 'Alpha', intent: 'open', rootPath: rootA } })
  const createdB = await call('/projects', { method: 'POST', body: { name: 'Beta', intent: 'open', rootPath: rootB } })
  assert(createdA.json?.ok && createdB.json?.ok, 'projects created')
  const projectA = createdA.json.value.id
  const projectB = createdB.json.value.id

  // 1. Focus A，然后 capture：recent_focus direct A
  await call(`/runtime/projects/${projectA}/focus`, { method: 'POST' })
  const byFocus = await call('/runtime/affinity/resolve', { method: 'POST', body: { capturedAt: new Date().toISOString() } })
  assert(byFocus.json?.value?.projectId === projectA, `focus -> A, got ${JSON.stringify(byFocus.json?.value)}`)
  assert(byFocus.json?.value?.reason === 'recent_focus', 'reason recent_focus')
  console.log('✓ recent_focus resolves to Project A')

  // 2. path affinity：A 目录下的文件 → A（即使 pinned B）
  await call('/runtime/registry/capture-target', { method: 'POST', body: { projectId: projectB } })
  const byPath = await call('/runtime/affinity/resolve', { method: 'POST', body: { capturedAt: new Date().toISOString(), localPath: join(rootA, 'docs', 'brief.md') } })
  assert(byPath.json?.value?.projectId === projectA && byPath.json?.value?.reason === 'path_inside_root', `path -> A, got ${JSON.stringify(byPath.json?.value)}`)
  console.log('✓ path_inside_root wins over pinned')

  // 3. explicit 优先
  const byExplicit = await call('/runtime/affinity/resolve', { method: 'POST', body: { capturedAt: new Date().toISOString(), explicitProjectId: projectB } })
  assert(byExplicit.json?.value?.projectId === projectB && byExplicit.json?.value?.reason === 'explicit', 'explicit -> B')
  console.log('✓ explicit wins')

  // 4. browser tab 绑定 → A
  await call('/runtime/registry/browser-tab', { method: 'POST', body: { profileId: 'p1', tabId: 7, projectId: projectA } })
  const byTab = await call('/runtime/affinity/resolve', { method: 'POST', body: { capturedAt: new Date().toISOString(), browser: { profileId: 'p1', tabId: 7 } } })
  assert(byTab.json?.value?.projectId === projectA && byTab.json?.value?.reason === 'browser_tab_bound', `tab -> A, got ${JSON.stringify(byTab.json?.value)}`)
  const clearedTab = await call('/runtime/registry/browser-tab', { method: 'POST', body: { profileId: 'p1', tabId: 7, projectId: null } })
  assert(clearedTab.json?.value?.browserTabBindings === undefined || Object.keys(clearedTab.json?.value?.browserTabBindings ?? {}).length === 0, 'tab binding cleared')
  console.log('✓ browser tab binding + clear')

  // 5. staging：取消 pin + 1 小时无活动 → staging 候选（不弹 picker）
  await call('/runtime/registry/capture-target', { method: 'POST', body: { projectId: null } })
  const staleCapturedAt = new Date(Date.now() + 60 * 60_000).toISOString()
  const unknown = await call('/runtime/affinity/resolve', { method: 'POST', body: { capturedAt: staleCapturedAt } })
  assert(unknown.json?.value?.projectId === undefined, 'unbound tab -> no direct project')
  const enqueued = await call('/runtime/captures/staging', {
    method: 'POST',
    body: {
      operationId: 'op-screenshot-1',
      kind: 'screenshot',
      payloadRef: 'file:///C:/shots/design-ref.png',
      source: { app: 'snipping-tool' },
      suggestedProjects: unknown.json?.value?.candidates ?? [],
      capturedAt: staleCapturedAt,
    },
  })
  assert(enqueued.status === 201 && enqueued.json?.ok, `staging enqueue: ${enqueued.status}`)
  const captureId = enqueued.json.value.id
  const pending = await call('/runtime/captures/staging?recent=3600000')
  assert(pending.json?.value?.pendingCount === 1, `pendingCount=1, got ${pending.json?.value?.pendingCount}`)
  assert(pending.json?.value?.items?.[0]?.id === captureId, 'item listed')
  console.log('✓ staging buffer: enqueue + pending count')

  // 6. resolve → B，重复 resolve 拒绝
  const resolved = await call(`/runtime/captures/${captureId}/resolve`, { method: 'POST', body: { projectId: projectB } })
  assert(resolved.json?.ok && resolved.json?.value?.resolvedProjectId === projectB, 'resolved to B')
  const doubleResolve = await call(`/runtime/captures/${captureId}/resolve`, { method: 'POST', body: { projectId: projectA } })
  assert(doubleResolve.status === 404, `double resolve -> 404, got ${doubleResolve.status}`)
  const pendingAfter = await call('/runtime/captures/staging?recent=3600000')
  assert(pendingAfter.json?.value?.pendingCount === 0, 'pendingCount=0 after resolve')
  console.log('✓ resolve + duplicate rejection')

  console.log('PHASE B SMOKE: ALL PASS')
} finally {
  core.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* best effort */ })
}
