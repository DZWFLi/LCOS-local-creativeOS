import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { createMvpSampleSnapshot } from '../apps/local-core/dist/mvp-sample-project.js'
import { createLocalCoreServer } from '../apps/local-core/dist/server.js'

const directory = await mkdtemp(join(tmpdir(), 'lcos-gatef-core-smoke-'))
let server
let metadata

try {
  const databasePath = join(directory, 'metadata.sqlite')
  metadata = new SqliteMetadataRepository(databasePath)
  const graph = createMvpSampleSnapshot(join(directory, 'project'), '2026-08-04T00:00:00.000Z')
  metadata.save(graph)

  const projectId = String(graph.project.id)
  const workspaceId = String(graph.workspaces[0].id)
  const firstView = graph.artifactViews[0]
  const secondView = graph.artifactViews[1]
  assert.ok(firstView && secondView, 'sample graph must contain two views')
  const firstViewId = String(firstView.id)
  const secondViewId = String(secondView.id)

  const token = 'gatef-core-smoke-token'
  const origin = 'http://127.0.0.1:43120'
  server = createLocalCoreServer({
    port: 0,
    metadataRepository: metadata,
    apiToken: token,
    allowedOrigins: [origin],
  })
  const address = await server.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const headers = {
    authorization: `Bearer ${token}`,
    origin,
    'content-type': 'application/json',
  }
  const request = async (path, init = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    })
    const body = await response.json()
    return { response, body }
  }

  const initial = await request(`/projects/${projectId}/active-context?workspaceId=${encodeURIComponent(workspaceId)}`)
  assert.equal(initial.response.status, 200)
  assert.equal(initial.body.value.version, 0)

  const updated = await request(`/projects/${projectId}/active-context`, {
    method: 'PUT',
    body: JSON.stringify({
      workspaceId,
      scopeId: String(firstView.scopeId),
      selectedViewIds: [firstViewId, secondViewId],
      pinnedContextIds: [secondViewId],
      excludedContextIds: [],
      viewport: { x: 10, y: 20, zoom: 0.9 },
      visibleViewIds: [firstViewId, secondViewId],
      expectedVersion: 0,
      updatedBy: 'web',
    }),
  })
  assert.equal(updated.response.status, 200)
  assert.equal(updated.body.value.version, 1)
  assert.deepEqual(updated.body.value.selectionOrder, [firstViewId, secondViewId])
  assert.ok(updated.body.value.nodes.length >= 2)

  const stale = await request(`/projects/${projectId}/active-context`, {
    method: 'PUT',
    body: JSON.stringify({
      workspaceId,
      scopeId: String(firstView.scopeId),
      selectedViewIds: [firstViewId],
      pinnedContextIds: [],
      excludedContextIds: [],
      expectedVersion: 0,
      updatedBy: 'codex',
    }),
  })
  assert.equal(stale.response.status, 409)

  const watchStarted = Date.now()
  const watched = await request(`/projects/${projectId}/active-context?workspaceId=${encodeURIComponent(workspaceId)}&afterVersion=1`)
  assert.equal(watched.response.status, 200)
  assert.equal(watched.body.value.version, 1)
  assert.ok(Date.now() - watchStarted >= 850, 'short-poll should hold when version has not advanced')

  const draft = await request(`/projects/${projectId}/command-drafts/selection?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      workspaceId,
      prompt: '把开场缩短到三秒',
      contextViewIds: [firstViewId],
      provider: 'codex',
      createAsNewNode: false,
    }),
  })
  assert.equal(draft.response.status, 200)

  const binding = await request(`/projects/${projectId}/provider-sessions/codex`, {
    method: 'PUT',
    body: JSON.stringify({
      externalSessionId: 'session-gatef-smoke',
      origin: 'watchdog',
      status: 'active',
      failureCount: 0,
    }),
  })
  assert.equal(binding.response.status, 200)

  const proposal = await request(`/projects/${projectId}/context-proposals`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId,
      baseContextVersion: 1,
      addViewIds: [],
      removeViewIds: [],
      targetViewId: firstViewId,
      reason: '用户明确要求把当前内容设为修改目标',
    }),
  })
  assert.equal(proposal.response.status, 201)

  const plan = await request(`/projects/${projectId}/runs/validate-plan`, {
    method: 'POST',
    body: JSON.stringify({
      schemaVersion: 1,
      workspaceId,
      prompt: '分析当前材料',
      intent: 'analyze',
      requestedProvider: 'codex',
      contextItems: [],
      editTargets: [],
      resultPolicy: { type: 'reply_only' },
      humanSummary: '分析当前材料。',
      risks: [],
      requiresConfirmation: false,
    }),
  })
  assert.equal(plan.response.status, 200)
  assert.equal(plan.body.value.intent, 'analyze')

  const unauthorized = await fetch(`${baseUrl}/projects/${projectId}/active-context?workspaceId=${encodeURIComponent(workspaceId)}`)
  assert.equal(unauthorized.status, 401)

  await server.close()
  server = undefined
  metadata.close()
  metadata = undefined

  metadata = new SqliteMetadataRepository(databasePath)
  assert.equal(metadata.schemaVersion, 14)
  assert.equal(metadata.getCommandDraft(projectId, workspaceId, 'selection')?.prompt, '把开场缩短到三秒')
  assert.equal(metadata.getProviderSessionBinding(projectId, 'codex')?.externalSessionId, 'session-gatef-smoke')
  assert.equal(metadata.getContextProposal(projectId, proposal.body.value.proposalId)?.status, 'pending')
  assert.equal(metadata.getActiveContext(projectId, workspaceId)?.version, 1)

  process.stdout.write(`${JSON.stringify({
    schemaVersion: metadata.schemaVersion,
    apiAuth: true,
    activeContextPersistence: true,
    activeContextCas: true,
    activeContextShortPoll: true,
    commandDraftPersistence: true,
    contextProposalPersistence: true,
    providerSessionAffinity: true,
    agentPlanGuard: true,
  })}\n`)
} finally {
  if (server) await server.close()
  if (metadata) metadata.close()
  await rm(directory, { recursive: true, force: true })
}
