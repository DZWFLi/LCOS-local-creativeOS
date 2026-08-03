import { mkdtempSync, rmSync } from 'node:fs'
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
})
