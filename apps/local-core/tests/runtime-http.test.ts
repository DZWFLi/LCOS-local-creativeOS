import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type {
  BridgeResultEnvelopeV0,
  BridgeRuntimePort,
  BridgeTaskEnvelopeV0,
  BridgeTaskIdentity,
} from '../src/runtime-adapter.js'
import { ContextManifestService } from '../src/context-manifest-service.js'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'
import { RuntimeAdapterService } from '../src/runtime-adapter.js'
import { RuntimeApplicationService } from '../src/runtime-application-service.js'
import { RuntimeResultIngestionService } from '../src/runtime-result-ingestion.js'
import { RuntimeReviewService } from '../src/runtime-review-service.js'
import { createLocalCoreServer, type LocalCoreServer } from '../src/server.js'

const roots: string[] = []
const repositories: SqliteMetadataRepository[] = []
const servers: LocalCoreServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  for (const repository of repositories.splice(0)) repository.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

class FakeBridge implements BridgeRuntimePort {
  task: BridgeTaskIdentity | undefined
  async createTask(envelope: BridgeTaskEnvelopeV0): Promise<BridgeTaskIdentity> {
    this.task = {
      taskId: `task-${envelope.lcosRunId}`,
      lcosRunId: envelope.lcosRunId,
      status: 'assigned',
      requestFingerprint: envelope.requestFingerprint,
      contractVersion: envelope.contractVersion,
    }
    return this.task
  }
  async findTaskByRunId(): Promise<BridgeTaskIdentity | undefined> { return this.task }
  async getResult(): Promise<BridgeResultEnvelopeV0 | undefined> { return undefined }
}

describe('Runtime HTTP closure', () => {
  it('creates a canonical Run and exposes it for browser restart recovery', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    roots.push(dbRoot, projectRoot)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-one')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-one',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!

    const createdResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instruction: 'Create a new Markdown draft.',
        outputIntent: 'revise',
        targetArtifactId: target.id,
      }),
    })
    expect(createdResponse.status).toBe(201)
    await expect(createdResponse.json()).resolves.toMatchObject({
      ok: true,
      value: {
        review: {
          run: { id: 'run-http-one', status: 'created' },
          dispatch: { status: 'planned' },
        },
      },
    })

    const listResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/runs?limit=1`)
    expect(listResponse.status).toBe(200)
    await expect(listResponse.json()).resolves.toMatchObject({
      ok: true,
      value: [{ run: { id: 'run-http-one' }, presentationPhase: 'created' }],
    })
  })

  it('exposes durable run events and cancels a bound Run over HTTP', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    roots.push(dbRoot, projectRoot)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-two')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-two',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!

    const createdResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instruction: 'Revise the script.',
        outputIntent: 'revise',
        targetArtifactId: target.id,
      }),
    })
    expect(createdResponse.status).toBe(201)
    const createdBody = await createdResponse.json() as { value: { review: { run: { id: string } } } }
    const runId = createdBody.value.review.run.id

    const eventsResponse = await fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/events`)
    expect(eventsResponse.status).toBe(200)
    const eventsBody = await eventsResponse.json() as { value: { type: string; sequence: number }[] }
    expect(eventsBody.value.map((event) => event.type)).toEqual(['run.queued'])

    await fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/dispatch`, { method: 'POST', body: '{}' })
    const cancelResponse = await fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(cancelResponse.status).toBe(200)
    const cancelBody = await cancelResponse.json() as { value: { review: { run: { status: string } } } }
    expect(cancelBody.value.review.run.status).toBe('cancelled')

    const eventsAfter = await fetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/events`)
    const eventsAfterBody = await eventsAfter.json() as { value: { type: string }[] }
    expect(eventsAfterBody.value.map((event) => event.type)).toEqual([
      'run.queued',
      'run.started',
      'run.cancelled',
    ])
  })

  it('serves Run Proposal, Workspace Membership and Provider status contracts', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    roots.push(dbRoot, projectRoot)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-three')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-three',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const workspaceId = String(snapshot.workspaces[0]!.id)
    const viewId = String(snapshot.artifactViews[0]!.id)

    const proposeResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/runs/propose`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: '分析这份脚本的节奏问题',
        requestedProvider: 'auto',
        contextItems: [{ artifactId: String(snapshot.artifacts[0]!.id), revisionId: String(snapshot.artifactRevisions[0]!.id), order: 1 }],
        editTargets: [],
        resultPolicy: { type: 'reply_only' },
      }),
    })
    expect(proposeResponse.status).toBe(200)
    const proposeBody = await proposeResponse.json() as { value: { summary: string; proposal: { intent: string } } }
    expect(proposeBody.value.proposal.intent).toBe('analyze')
    expect(proposeBody.value.summary).toContain('分析')

    const addResponse = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewIds: [viewId] }),
    })
    expect(addResponse.status).toBe(200)
    const addBody = await addResponse.json() as { value: { artifactViewId: string }[] }
    expect(addBody.value.map((item) => item.artifactViewId)).toContain(viewId)

    const listResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/workspace-memberships`)
    const listBody = await listResponse.json() as { value: { artifactViewId: string }[] }
    expect(listBody.value.map((item) => item.artifactViewId)).toContain(viewId)

    const removeResponse = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(viewId)}`, {
      method: 'DELETE',
    })
    expect(removeResponse.status).toBe(200)
    const removeBody = await removeResponse.json() as { value: { artifactViewId: string }[] }
    expect(removeBody.value).toHaveLength(0)

    const providersResponse = await fetch(`${baseUrl}/runtime/providers`)
    expect(providersResponse.status).toBe(200)
    const providersBody = await providersResponse.json() as { value: { provider: string; availability: string }[] }
    expect(providersBody.value.map((item) => item.provider)).toEqual(['workbuddy', 'codex', 'auto'])
  })

  it('serves revision/process/workspace-state/session backend contracts', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    roots.push(dbRoot, projectRoot)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-four')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-four',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const artifactId = String(snapshot.artifacts[0]!.id)
    const revisionId = String(snapshot.artifactRevisions[0]!.id)
    const workspaceId = String(snapshot.workspaces[0]!.id)

    const searchResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/artifacts/search?q=${encodeURIComponent(snapshot.artifacts[0]!.title.slice(0, 3))}`)
    const searchBody = await searchResponse.json() as { value: { id: string }[] }
    expect(searchBody.value.map((item) => item.id)).toContain(artifactId)

    const detailResponse = await fetch(`${baseUrl}/artifacts/${encodeURIComponent(artifactId)}`)
    const detailBody = await detailResponse.json() as { value: { artifact: { id: string }; revisions: { id: string }[] } }
    expect(detailBody.value.artifact.id).toBe(artifactId)
    expect(detailBody.value.revisions.map((item) => item.id)).toContain(revisionId)

    const listResponse = await fetch(`${baseUrl}/artifacts/${encodeURIComponent(artifactId)}/revisions`)
    const listBody = await listResponse.json() as { value: { id: string }[] }
    expect(listBody.value.map((item) => item.id)).toContain(revisionId)

    const compareResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/revisions/compare?base=${encodeURIComponent(revisionId)}&head=${encodeURIComponent(revisionId)}`)
    expect(compareResponse.status).toBe(200)
    const compareBody = await compareResponse.json() as { value: { changed: boolean; contentAvailable: boolean } }
    expect(compareBody.value.changed).toBe(false)
    expect(compareBody.value.contentAvailable).toBe(true)

    const projectionResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/process-projection`)
    const projectionBody = await projectionResponse.json() as { value: { kind: string }[] }
    expect(projectionBody.value.some((item) => item.kind === 'revision')).toBe(true)

    const saveStateResponse = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/states`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '现场A' }),
    })
    expect(saveStateResponse.status).toBe(201)
    const saveStateBody = await saveStateResponse.json() as { value: { id: string; workspaceId?: string } }
    expect(saveStateBody.value.workspaceId).toBe(workspaceId)

    const statesResponse = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/states`)
    const statesBody = await statesResponse.json() as { value: { id: string }[] }
    expect(statesBody.value.map((item) => item.id)).toContain(saveStateBody.value.id)

    const restoreResponse = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/states/${encodeURIComponent(saveStateBody.value.id)}/restore`, {
      method: 'POST',
    })
    expect(restoreResponse.status).toBe(200)

    const sessionResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/session-summaries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '收口', summary: '方向已定', handoffRef: 'docs/x.md' }),
    })
    expect(sessionResponse.status).toBe(201)
    const sessionsResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/session-summaries`)
    const sessionsBody = await sessionsResponse.json() as { value: { title: string }[] }
    expect(sessionsBody.value.map((item) => item.title)).toContain('收口')
  })

  it('exports and reopens a .lcosproj project file over HTTP', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    const outDir = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-out-'))
    roots.push(dbRoot, projectRoot, outDir)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-five')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-five',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const targetFile = join(outDir, '项目.lcosproj')

    const exportResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/export-lcosproj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetPath: targetFile }),
    })
    expect(exportResponse.status).toBe(201)
    const exportBody = await exportResponse.json() as { value: { path: string; projectId: string; schemaVersion: number } }
    expect(exportBody.value.projectId).toBe(String(snapshot.project.id))
    expect(exportBody.value.schemaVersion).toBe(13)
    expect(existsSync(targetFile)).toBe(true)

    const inspectResponse = await fetch(`${baseUrl}/lcosproj/inspect?file=${encodeURIComponent(targetFile)}`)
    expect(inspectResponse.status).toBe(200)
    const inspectBody = await inspectResponse.json() as { value: { project: { id: string } } }
    expect(inspectBody.value.project.id).toBe(String(snapshot.project.id))

    const openResponse = await fetch(`${baseUrl}/lcosproj/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filePath: targetFile }),
    })
    expect(openResponse.status).toBe(200)
    const openBody = await openResponse.json() as { value: { project: { id: string }; tables: { artifacts: number } } }
    expect(openBody.value.project.id).toBe(String(snapshot.project.id))
    expect(openBody.value.tables.artifacts).toBe(snapshot.artifacts.length)
  })

  it('creates a managed Text Artifact that can enter Run Context', async () => {
    const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-db-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-http-project-'))
    roots.push(dbRoot, projectRoot)
    const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(projectRoot, '2026-07-29T19:30:00.000Z')
    repository.save(snapshot)
    const bridge = new FakeBridge()
    const review = new RuntimeReviewService(repository, undefined, () => 'http-six')
    const application = new RuntimeApplicationService(
      repository,
      new ContextManifestService(repository),
      new RuntimeAdapterService(repository, bridge, 'mvp-fast-build'),
      new RuntimeResultIngestionService(repository, bridge),
      review,
      undefined,
      () => 'http-six',
    )
    const server = createLocalCoreServer({
      port: 0,
      metadataRepository: repository,
      runtimeReviewService: review,
      runtimeApplicationService: application,
    })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const scopeId = String(snapshot.scopes[0]!.id)
    const workspaceId = String(snapshot.workspaces[0]!.id)

    const createResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/text-artifacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: '开场要压到三秒。', scopeId, workspaceId, x: 40, y: 60 }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as { value: { artifactId: string; revisionId: string; viewId: string } }
    const artifact = repository.getArtifact(created.value.artifactId)
    expect(artifact?.managed).toBe(true)
    expect(artifact?.kind).toBe('markdown')
    expect(repository.getArtifactRevision(created.value.revisionId)?.status).toBe('current')
    expect(repository.listWorkspaceMembers(workspaceId as never).map((item) => String(item.artifactViewId)))
      .toContain(created.value.viewId)

    const proposeResponse = await fetch(`${baseUrl}/projects/${snapshot.project.id}/runs/propose`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: '根据这条文本分析节奏问题',
        requestedProvider: 'auto',
        contextItems: [{ artifactId: created.value.artifactId, revisionId: created.value.revisionId, order: 1 }],
        editTargets: [],
        resultPolicy: { type: 'reply_only' },
      }),
    })
    expect(proposeResponse.status).toBe(200)
    const proposeBody = await proposeResponse.json() as { value: { proposal: { contextItems: { artifactId: string }[] } } }
    expect(proposeBody.value.proposal.contextItems.map((item) => item.artifactId)).toContain(created.value.artifactId)
  })
})
