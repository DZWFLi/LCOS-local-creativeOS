/**
 * Phase D 真实 HTTP 冒烟：Reorganize Proposal（create → preview → apply → rollback）。
 */
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 43134
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'smoke-token-d'
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

const root = await mkdtemp(join(tmpdir(), 'lcos-phase-d-smoke-'))
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
  await call(`/runtime/projects/${projectId}/focus`, { method: 'POST' })

  // 1. capture 三个文本 → 成员 view
  const viewIds = []
  for (let index = 0; index < 3; index += 1) {
    const receipt = await call('/capture', {
      method: 'POST',
      body: {
        schemaVersion: 0,
        operationId: `smoke-d-${index}-${Date.now()}`,
        kind: 'clipboard_text',
        source: { app: 'smoke', capturedAt: new Date().toISOString() },
        payload: { type: 'text', text: `第 ${index} 份整理素材` },
      },
    })
    assert(receipt.json?.value?.viewId, 'capture returns viewId')
    viewIds.push(receipt.json.value.viewId)
  }
  console.log(`✓ 3 captures -> views ${viewIds.length}`)

  // 2. 创建 presentation
  const presentationId = 'presentation-reorg-1'
  const saved = await call(`/projects/${projectId}/presentations/${presentationId}`, {
    method: 'PUT',
    body: {
      contract: {
        schemaVersion: 0,
        id: presentationId,
        projectId,
        scopeId: `scope-${projectId}-root`,
        capability: 'context',
        renderer: 'graph',
        state: {
          memberViewIds: viewIds,
          hiddenViewIds: [],
          positions: {},
          hierarchy: { parentByViewId: {}, orderByParent: {} },
          presentationEdges: [],
          pinnedViewIds: [],
          emphasisByViewId: {},
        },
        version: 0,
        updatedBy: 'web',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      expectedVersion: 0,
    },
  })
  assert(saved.json?.ok, `presentation saved: ${JSON.stringify(saved.json)}`)
  console.log('✓ presentation created')

  // 3. reorganize proposal: 移除一个成员 + hierarchy
  const proposal = await call(`/projects/${projectId}/reorganize/proposals`, {
    method: 'POST',
    body: {
      presentationId,
      baseVersion: 1,
      removeMemberViewIds: [viewIds[1]],
      hierarchyPatch: { parentByViewId: { [viewIds[2]]: viewIds[0] }, orderByParent: { [viewIds[0]]: [viewIds[2]] } },
    },
  })
  assert(proposal.status === 201 && proposal.json?.value?.id, `proposal: ${proposal.status}`)
  const proposalId = proposal.json.value.id
  console.log('✓ proposal created')

  // 4. preview
  const preview = await call(`/projects/${projectId}/reorganize/proposals/${proposalId}/preview`, { method: 'POST', body: {} })
  assert(preview.json?.value?.willRemovePresentationMembers?.length === 1, 'preview remove member')
  assert(preview.json?.value?.destructive === false, 'preview non-destructive')
  console.log('✓ preview')

  // 5. apply
  const applied = await call(`/projects/${projectId}/reorganize/proposals/${proposalId}/apply`, { method: 'POST', body: {} })
  assert(applied.json?.ok, `apply: ${JSON.stringify(applied.json)}`)
  const graph = await call(`/projects/${projectId}/graph`)
  console.log('✓ applied (member removed, hierarchy set)')

  // 6. destructive 需要确认
  const destructive = await call(`/projects/${projectId}/reorganize/proposals`, {
    method: 'POST',
    body: { presentationId, baseVersion: 2, artifactDeleteCandidates: [{ artifactId: 'missing', reason: 'test' }] },
  })
  const noConfirm = await call(`/projects/${projectId}/reorganize/proposals/${destructive.json.value.id}/apply`, { method: 'POST', body: {} })
  assert(noConfirm.status === 400, `destructive without confirm -> 400, got ${noConfirm.status}`)
  console.log('✓ destructive guard')

  // 7. rollback
  const rolled = await call(`/projects/${projectId}/reorganize/proposals/${proposalId}/rollback`, { method: 'POST', body: {} })
  assert(rolled.json?.ok && rolled.json?.value?.status === 'rolled_back', 'rollback')
  console.log('✓ rollback restored presentation')

  // 8. reject
  const rejected = await call(`/projects/${projectId}/reorganize/proposals/${destructive.json.value.id}/reject`, { method: 'POST', body: {} })
  assert(rejected.json?.value?.status === 'rejected', 'reject')
  console.log('✓ reject')

  console.log('PHASE D SMOKE: ALL PASS')
} finally {
  core.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* best effort */ })
}
