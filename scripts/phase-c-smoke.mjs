/**
 * Phase C 真实 HTTP 冒烟：Capture 全链路（幂等 / affinity / staged blob / extension token / watch rules）。
 */
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 43133
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'smoke-token-c'
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

const root = await mkdtemp(join(tmpdir(), 'lcos-phase-c-smoke-'))
const blobRoot = join(root, 'blobs')
await mkdir(blobRoot, { recursive: true })
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
    LCOS_CAPTURE_STAGING_ROOT: blobRoot,
  },
})

try {
  await waitForHealth()

  const projectRoot = join(root, 'project-a')
  await mkdir(projectRoot, { recursive: true })
  const created = await call('/projects', { method: 'POST', body: { name: 'Alpha', intent: 'open', rootPath: projectRoot } })
  assert(created.json?.ok, 'project created')
  const projectId = created.json.value.id
  await call(`/runtime/projects/${projectId}/focus`, { method: 'POST' })

  // 1. text capture with recent focus → created
  const captureBody = (overrides = {}) => ({
    schemaVersion: 0,
    operationId: `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'clipboard_text',
    source: { app: 'smoke', capturedAt: new Date().toISOString() },
    payload: { type: 'text', text: '这是冒烟测试捕获的文本' },
    ...overrides,
  })
  const first = await call('/capture', { method: 'POST', body: captureBody() })
  assert(first.status === 201 && first.json?.value?.status === 'created', `text capture: ${first.status} ${JSON.stringify(first.json)}`)
  assert(first.json?.value?.artifactId, 'artifactId present')
  console.log('✓ text capture -> created (recent focus affinity)')

  // 2. idempotent: same operationId returns same receipt
  const opId = `smoke-idem-${Date.now()}`
  const idemBody = captureBody({ operationId: opId })
  const a = await call('/capture', { method: 'POST', body: idemBody })
  const b = await call('/capture', { method: 'POST', body: idemBody })
  assert(JSON.stringify(a.json.value) === JSON.stringify(b.json.value), 'idempotent receipt')
  console.log('✓ capture idempotent by operationId')

  // 3. explicit targetHint bypasses affinity
  const explicit = await call('/capture', {
    method: 'POST',
    body: captureBody({ kind: 'web_page', targetHint: { projectId }, payload: { type: 'url', url: 'https://example.com' } }),
  })
  assert(explicit.json?.value?.status === 'created' || explicit.json?.value?.status === 'reused', `explicit capture: ${JSON.stringify(explicit.json)}`)
  console.log('✓ explicit targetHint capture')

  // 4. staged blob → created
  const bytes = new TextEncoder().encode('fake-screenshot')
  const hash = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(blobRoot, hash), bytes)
  const blob = await call('/capture', {
    method: 'POST',
    body: captureBody({ kind: 'screenshot', payload: { type: 'staged_blob', blobRef: `blob:${hash}` } }),
  })
  assert(blob.json?.value?.status === 'created', `blob capture: ${JSON.stringify(blob.json)}`)
  console.log('✓ staged blob capture -> created')

  // 5. extension token (idempotent)
  const token1 = await call('/runtime/extension-token', { method: 'POST', body: '{}' })
  const token2 = await call('/runtime/extension-token', { method: 'POST', body: '{}' })
  assert(token1.json?.value?.token && token1.json?.value?.token === token2.json?.value?.token, 'extension token idempotent')
  console.log('✓ extension token pairing')

  // 6. watch rules CRUD
  const watchDir = join(root, 'shots')
  await mkdir(watchDir, { recursive: true })
  const rule = await call('/runtime/capture-watch/rules', {
    method: 'POST',
    body: { id: 'rule-1', path: watchDir, patterns: ['.png'], projectHint: projectId, settleMs: 200, enabled: true },
  })
  assert(rule.json?.value?.[0]?.id === 'rule-1', 'watch rule created')
  const rules = await call('/runtime/capture-watch/rules')
  assert(rules.json?.value?.length === 1, 'watch rules listed')
  const deleted = await call('/runtime/capture-watch/rules?id=rule-1', { method: 'DELETE' })
  assert(deleted.json?.value?.deleted === true, 'watch rule deleted')
  console.log('✓ capture watch rules CRUD')

  // 7. failure path: bad capture body
  const bad = await call('/capture', { method: 'POST', body: { operationId: 'x' } })
  assert(bad.status === 400, `bad capture -> 400, got ${bad.status}`)
  console.log('✓ failure path validation')

  console.log('PHASE C SMOKE: ALL PASS')
} finally {
  core.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* best effort */ })
}
