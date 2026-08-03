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
import { RuntimeAdapterError, RuntimeAdapterService } from '../src/runtime-adapter.js'
import { RuntimeApplicationService } from '../src/runtime-application-service.js'
import { RuntimeResultIngestionService } from '../src/runtime-result-ingestion.js'
import { RuntimeReviewService } from '../src/runtime-review-service.js'

const roots: string[] = []
const repositories: SqliteMetadataRepository[] = []
const now = '2026-07-29T19:00:00.000Z'

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

class FakeBridge implements BridgeRuntimePort {
  createError: Error | undefined
  cancelledTaskIds: string[] = []
  async createTask(envelope: BridgeTaskEnvelopeV0): Promise<BridgeTaskIdentity> {
    if (this.createError !== undefined) throw this.createError
    return {
      taskId: `task-${envelope.lcosRunId}`,
      lcosRunId: envelope.lcosRunId,
      status: 'assigned',
      requestFingerprint: envelope.requestFingerprint,
      contractVersion: envelope.contractVersion,
    }
  }
  async findTaskByRunId(): Promise<BridgeTaskIdentity | undefined> { return undefined }
  async getResult(): Promise<BridgeResultEnvelopeV0 | undefined> { return undefined }
  async cancelTask(taskId: string): Promise<void> { this.cancelledTaskIds.push(taskId) }
}

function setup() {
  const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-app-db-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-app-project-'))
  roots.push(dbRoot, projectRoot)
  const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
  repositories.push(repository)
  const snapshot = createMvpSampleSnapshot(projectRoot, now)
  repository.save(snapshot)
  const bridge = new FakeBridge()
  const review = new RuntimeReviewService(repository, () => now, () => 'retry-one')
  const service = new RuntimeApplicationService(
    repository,
    new ContextManifestService(repository),
    new RuntimeAdapterService(repository, bridge, 'mvp-fast-build', () => now),
    new RuntimeResultIngestionService(repository, bridge, () => now),
    review,
    () => now,
    () => 'one',
  )
  return { bridge, projectRoot, repository, service, snapshot }
}

describe('RuntimeApplicationService', () => {
  it('creates, dispatches and lists a canonical Run for restart recovery', async () => {
    const { repository, service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: 'Revise the script without overwriting the source.',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
      workspaceId: String(snapshot.workspaces[0]!.id),
    })
    expect(result.review).toMatchObject({ run: { status: 'created' }, dispatch: { status: 'planned' } })
    const dispatched = await service.dispatch(result.review.run.id)

    expect(dispatched.providerError).toBeUndefined()
    expect(dispatched.review).toMatchObject({
      run: { id: 'run-one', status: 'queued', targetArtifactId: target.id },
      dispatch: { status: 'bound', idempotencyKey: 'run-one' },
      binding: { externalTaskId: 'task-run-one', providerStatus: 'assigned' },
      presentationPhase: 'queued',
    })
    expect(repository.getProjectRuns(snapshot.project.id, 1)).toHaveLength(1)

    const databasePath = repository.databasePath
    repository.close()
    repositories.splice(repositories.indexOf(repository), 1)
    const restarted = new SqliteMetadataRepository(databasePath)
    repositories.push(restarted)
    expect(restarted.getProjectRuns(snapshot.project.id, 1)[0]).toMatchObject({
      id: 'run-one',
      contextManifestId: dispatched.review.run.contextManifestId,
    })
  })

  it('keeps the canonical Run and exposes recovery when Bridge dispatch is unavailable', async () => {
    const { bridge, repository, service, snapshot } = setup()
    bridge.createError = new RuntimeAdapterError({
      code: 'BRIDGE_UNAVAILABLE',
      message: 'Bridge is offline.',
      retryable: true,
      provider: 'workbuddy',
    })
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: 'Revise the script.',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
    })
    const dispatched = await service.dispatch(result.review.run.id)

    expect(dispatched.providerError).toMatchObject({ code: 'BRIDGE_UNAVAILABLE', retryable: true })
    expect(dispatched.review.run.status).toBe('created')
    expect(dispatched.review.dispatch.status).toBe('recovery_required')
    expect(repository.getProjectRuns(snapshot.project.id, 10)).toHaveLength(1)
  })

  it('emits durable run events across create/dispatch/accept', async () => {
    const { repository, service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: 'Revise the script.',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
    })
    const runId = result.review.run.id
    const dispatched = await service.dispatch(runId)
    expect(dispatched.providerError).toBeUndefined()
    expect(dispatched.review.dispatch.status).toBe('bound')

    const events = repository.getRunEvents(runId)
    const types = events.map((event) => event.type)
    expect(types).toContain('run.queued')
    expect(types).toContain('run.started')
    expect(events.map((event) => event.sequence)).toEqual([1, 2])
  })

  it('cancels a bound Run through the Bridge and records run.cancelled', async () => {
    const { bridge, repository, service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: 'Revise the script.',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
    })
    const runId = result.review.run.id
    await service.dispatch(runId)

    const cancelled = await service.cancel(runId)
    expect(cancelled.review.run.status).toBe('cancelled')
    expect(bridge.cancelledTaskIds).toHaveLength(1)
    expect(repository.getRunEvents(runId).map((event) => event.type)).toContain('run.cancelled')
  })

  it('refuses to cancel a terminal Run', async () => {
    const { repository, service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: 'Revise the script.',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
    })
    const runId = result.review.run.id
    repository.updateRunStatus(runId, 'completed', now)
    const cancelled = await service.cancel(runId)
    expect(cancelled.providerError).toMatchObject({ code: 'RUN_ALREADY_TERMINAL', retryable: false })
    expect(repository.getRun(runId)?.status).toBe('completed')
  })

  it('rejects analyze/create runs that carry a modify target', async () => {
    const { service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    await expect(service.create(snapshot.project.id, {
      instruction: '分析脚本。',
      outputIntent: 'analyze',
      targetArtifactId: String(target.id),
    })).rejects.toThrow(/analyze 不允许指定修改目标/)
    await expect(service.create(snapshot.project.id, {
      instruction: '创建新文件。',
      outputIntent: 'create',
      targetArtifactId: String(target.id),
    })).rejects.toThrow(/create 不允许指定修改目标/)
  })

  it('persists the result policy on the canonical Run', async () => {
    const { repository, service, snapshot } = setup()
    const target = snapshot.artifacts.find((artifact) => artifact.kind === 'markdown')!
    const result = await service.create(snapshot.project.id, {
      instruction: '修改脚本。',
      outputIntent: 'revise',
      targetArtifactId: String(target.id),
      resultPolicy: { type: 'draft_revision_per_target' },
    })
    expect(repository.getRun(result.review.run.id)?.resultPolicy).toEqual({ type: 'draft_revision_per_target' })
  })
})
