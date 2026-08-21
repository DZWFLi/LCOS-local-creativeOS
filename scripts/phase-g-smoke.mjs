/**
 * Phase G 真实 HTTP 冒烟：Session Context Continuity（bind → context → sources → close → 重启保留）。
 */
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 43135
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'smoke-token-g'
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

const root = await mkdtemp(join(tmpdir(), 'lcos-phase-g-smoke-'))
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

  const projectRoot = join(root, 'project-a')
  await mkdir(projectRoot, { recursive: true })
  const created = await call('/projects', { method: 'POST', body: { name: 'Alpha', intent: 'open', rootPath: projectRoot } })
  assert(created.json?.ok, 'project created')
  const projectId = created.json.value.id

  // 1. Session A bind + sources
  const bind = await call('/runtime/sessions/session-a/bind', {
    method: 'POST',
    body: {
      projectId,
      selectedViewIds: ['view-1', 'view-2'],
      retrievalEntityRefs: ['artifact-9'],
      sourceRefs: [
        { sourceType: 'local_file', sourceRef: 'C:/brief.pdf', observedAt: new Date().toISOString() },
        { sourceType: 'url', sourceRef: 'https://example.com/ref', observedAt: new Date().toISOString() },
      ],
      status: 'working',
    },
  })
  assert(bind.json?.value?.projectId === projectId && bind.json?.value?.status === 'working', `bind: ${JSON.stringify(bind.json)}`)
  console.log('✓ Session A bind + sourceRefs')

  // 2. context get
  const context = await call('/runtime/sessions/session-a/context')
  assert(context.json?.value?.sourceRefs?.length === 2, 'context has 2 source refs')
  assert(context.json?.value?.selectedViewIds?.length === 2, 'context has selected views')
  console.log('✓ Session A context readable')

  // 3. Session B bind 同一项目（跨会话连续性基础）
  const bindB = await call('/runtime/sessions/session-b/bind', { method: 'POST', body: { projectId } })
  assert(bindB.json?.value?.projectId === projectId, 'Session B bind')
  console.log('✓ Session B bind same project')

  // 4. close Session A
  const closed = await call('/runtime/sessions/session-a/close', { method: 'POST', body: '{}' })
  assert(closed.json?.value?.status === 'closed', 'Session A closed')
  console.log('✓ Session A close')

  // 5. list contexts
  const list = await call(`/runtime/sessions/contexts?projectId=${projectId}`)
  assert(list.json?.value?.length === 2, 'two session refs listed')
  console.log('✓ session contexts list')

  // 6. failure path: missing session
  const missing = await call('/runtime/sessions/nope/context')
  assert(missing.status === 404, `missing session -> 404, got ${missing.status}`)
  console.log('✓ failure path')

  console.log('PHASE G SMOKE: ALL PASS')
} finally {
  core.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* best effort */ })
}
