import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PersistedContextManifestV0 } from '@local-creative-os/contracts'
import type { Run, RuntimeDispatch } from '@local-creative-os/domain'
import { afterEach, describe, expect, it } from 'vitest'

import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'
import { EXECUTION_ITEM_DEFAULT_CAPABILITIES, ExecutionItemService } from '../src/execution-item-service.js'

const cleanup: string[] = []

afterEach(async () => {
  for (const path of cleanup.splice(0)) void rm(path, { recursive: true, force: true }).catch(() => { /* best effort */ })
})

function createRun(repository: SqliteMetadataRepository, snapshot: ReturnType<typeof createMvpSampleSnapshot>, index: number, status: Run['status'], targetId: Run['targetArtifactId']): Run {
  const manifestJson = JSON.stringify({ schemaVersion: 0, sequence: index, target: { artifactId: String(targetId ?? '') }, references: [] })
  const manifestId = `manifest-exec-${index}` as PersistedContextManifestV0['id']
  repository.createContextManifest({
    id: manifestId,
    projectId: snapshot.project.id,
    schemaVersion: 0,
    targetArtifactId: targetId ?? snapshot.artifacts[0]!.id,
    targetRevisionId: snapshot.artifacts[0]!.currentRevisionId,
    canonicalJson: manifestJson,
    manifestHash: createHash('sha256').update(manifestJson).digest('hex'),
    createdAt: `2026-08-04T09:0${index}:00.000Z`,
  })
  const run: Run = {
    id: `run-exec-${index}` as Run['id'],
    projectId: snapshot.project.id,
    workspaceId: snapshot.workspaces[0]!.id,
    targetArtifactId: targetId,
    targetRevisionId: targetId === undefined ? undefined : snapshot.artifacts[0]!.currentRevisionId,
    contextManifestId: manifestId,
    provider: 'codex',
    requestedProvider: 'codex',
    outputIntent: 'revise',
    returnGroupId: `return-group-exec-${index}`,
    status,
    instruction: `Execution run ${index}`,
    createdAt: `2026-08-04T09:0${index}:00.000Z`,
    updatedAt: `2026-08-04T09:0${index}:30.000Z`,
  }
  repository.createRunWithDispatch(run, {
    id: `dispatch-exec-${index}` as RuntimeDispatch['id'],
    runId: run.id,
    provider: 'codex',
    idempotencyKey: String(run.id),
    status: 'bound',
    attemptCount: 1,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  })
  return run
}

describe('ExecutionItemService', () => {
  it('projects canonical runs into ExecutionItemV1 with honest derived fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lcos-execution-item-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const snapshot = createMvpSampleSnapshot(directory, '2026-08-04T09:00:00.000Z')
    repository.save(snapshot)
    try {
      createRun(repository, snapshot, 0, 'waiting_input', snapshot.artifacts[0]!.id)
      createRun(repository, snapshot, 1, 'running', snapshot.artifacts[0]!.id)
      createRun(repository, snapshot, 2, 'completed', snapshot.artifacts[0]!.id)
      createRun(repository, snapshot, 3, 'failed', undefined)

      const items = new ExecutionItemService(repository).project(snapshot.project.id)
      expect(items).toHaveLength(4)

      const waiting = items.find((item) => item.runId === 'run-exec-0')!
      expect(waiting.state).toBe('waiting_input')
      expect(waiting.needsAttention).toBe(true)
      expect(waiting.availableActions).toEqual(['cancel', 'answer_input'])
      expect(waiting.targetRef).toEqual({ kind: 'artifact', artifactId: String(snapshot.artifacts[0]!.id) })
      expect(waiting.progress).toBeNull()
      expect(waiting.proposalRef).toBeNull()
      expect(waiting.schemaVersion).toBe(1)
      expect(waiting.kind).toBe('run')

      const running = items.find((item) => item.runId === 'run-exec-1')!
      expect(running.needsAttention).toBe(false)
      // pause capability is honestly false until S7 → only cancel derives
      expect(running.availableActions).toEqual(['cancel'])

      const completed = items.find((item) => item.runId === 'run-exec-2')!
      expect(completed.availableActions).toEqual([])
      expect(completed.needsAttention).toBe(false)

      const failed = items.find((item) => item.runId === 'run-exec-3')!
      expect(failed.needsAttention).toBe(true)
      expect(failed.availableActions).toEqual(['retry'])
      expect(failed.targetRef).toBeNull()

      for (const item of items) {
        expect(item.id.startsWith('execution-')).toBe(true)
        expect(item.updatedAt >= item.createdAt).toBe(true)
      }
    } finally {
      repository.close()
    }
  })

  it('declares default capabilities matching the S0 census control-operation matrix', () => {
    expect(EXECUTION_ITEM_DEFAULT_CAPABILITIES).toEqual({ pause: false, resume: false, cancel: true, retry: true, answerInput: true })
  })
})
