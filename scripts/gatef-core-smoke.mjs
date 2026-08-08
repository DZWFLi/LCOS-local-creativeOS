import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

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

  const vaultPath = join(directory, 'obsidian-vault')
  await mkdir(join(vaultPath, '.obsidian'), { recursive: true })
  await mkdir(join(vaultPath, 'campaign'), { recursive: true })
  await writeFile(join(vaultPath, '.obsidian', 'workspace.json'), '{}')
  await writeFile(join(vaultPath, 'campaign', 'brief.md'), '---\ntitle: Vault Brief\ntags: [launch]\n---\n# Brief\nSee [[campaign/script]].\n')
  await writeFile(join(vaultPath, 'campaign', 'script.md'), '# Script\n')
  const vaultBriefHash = createHash('sha256').update(await readFile(join(vaultPath, 'campaign', 'brief.md'))).digest('hex')

  const token = 'gatef-core-smoke-token'
  const origin = 'http://127.0.0.1:43120'
  server = createLocalCoreServer({
    port: 0,
    metadataRepository: metadata,
    apiToken: token,
    allowedOrigins: [origin],
    directoryPicker: async () => ({ cancelled: false, path: vaultPath }),
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
  assert.ok(Array.isArray(updated.body.value.offscreenClusters), 'offscreen cluster summary must be projected')
  assert.ok(Array.isArray(updated.body.value.recentChanges), 'recent canvas changes must be projected')
  assert.ok(updated.body.value.recentChanges.some((change) => change.kind === 'selection'), 'selection change must be recorded')

  const observation = await request(`/projects/${projectId}/canvas-observation?workspaceId=${encodeURIComponent(workspaceId)}`)
  assert.equal(observation.response.status, 200)
  assert.equal(observation.body.value.mimeType, 'image/svg+xml')
  assert.equal(observation.body.value.contextVersion, 1)
  assert.match(observation.body.value.screenshotRef, /^lcos-canvas:\/\//)
  assert.match(Buffer.from(observation.body.value.data, 'base64').toString('utf8'), /LCOS Canvas Observation/)

  const relationId = 'relation-gatef-smoke'
  const relation = await request(`/projects/${projectId}/relations/${relationId}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: relationId,
      projectId,
      sourceEntityType: 'artifact',
      sourceEntityId: String(firstView.artifactId),
      targetEntityType: 'artifact',
      targetEntityId: String(secondView.artifactId),
      kind: 'reference',
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    }),
  })
  assert.equal(relation.response.status, 200)
  const invalidRelation = await request(`/projects/${projectId}/relations/relation-invalid`, {
    method: 'PUT',
    body: JSON.stringify({
      id: 'relation-invalid',
      projectId,
      sourceEntityType: 'artifact',
      sourceEntityId: 'artifact-not-in-project',
      targetEntityType: 'artifact',
      targetEntityId: String(secondView.artifactId),
      kind: 'reference',
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    }),
  })
  assert.equal(invalidRelation.response.status, 400)

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

  const connectorCapabilities = await request('/connectors')
  assert.equal(connectorCapabilities.response.status, 200)
  assert.deepEqual(connectorCapabilities.body.value.find((item) => item.connector === 'obsidian'), {
    schemaVersion: 1,
    connector: 'obsidian',
    displayName: 'Obsidian Vault',
    sourceKind: 'local_directory',
    access: 'read_only',
    contentTypes: ['text/markdown'],
    supportsScan: true,
    supportsImport: true,
    supportsSync: false,
  })

  const obsidianScan = await request('/connectors/obsidian/select-and-scan', { method: 'POST', body: '{}' })
  assert.equal(obsidianScan.response.status, 200)
  assert.equal(obsidianScan.body.value.readOnly, true)
  assert.equal(obsidianScan.body.value.noteCount, 2)
  assert.equal(JSON.stringify(obsidianScan.body).includes(vaultPath), false)
  assert.equal(obsidianScan.body.value.notes.some((note) => note.relativePath.startsWith('.obsidian/')), false)

  const obsidianImport = await request(`/projects/${projectId}/connectors/obsidian/import`, {
    method: 'POST',
    body: JSON.stringify({
      scanId: obsidianScan.body.value.scanId,
      relativePaths: ['campaign/brief.md'],
      scopeId: String(firstView.scopeId),
      position: { x: 640, y: 320 },
    }),
  })
  assert.equal(obsidianImport.response.status, 201)
  assert.equal(obsidianImport.body.value.length, 1)
  const serializedImport = JSON.stringify(obsidianImport.body)
  assert.equal(serializedImport.includes(vaultPath), false)
  assert.equal(serializedImport.includes('observedPath'), false)
  assert.equal(createHash('sha256').update(await readFile(join(vaultPath, 'campaign', 'brief.md'))).digest('hex'), vaultBriefHash)

  const unauthorized = await fetch(`${baseUrl}/projects/${projectId}/active-context?workspaceId=${encodeURIComponent(workspaceId)}`)
  assert.equal(unauthorized.status, 401)

  await server.close()
  server = undefined
  metadata.close()
  metadata = undefined

  metadata = new SqliteMetadataRepository(databasePath)
  assert.equal(metadata.schemaVersion, 20)
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
    canvasObservation: true,
    safeRelationCommand: true,
    commandDraftPersistence: true,
    contextProposalPersistence: true,
    providerSessionAffinity: true,
    agentPlanGuard: true,
    connectorPort: true,
    obsidianReadOnlyImport: true,
  })}\n`)
} finally {
  if (server) await server.close()
  if (metadata) metadata.close()
  await rm(directory, { recursive: true, force: true })
}
