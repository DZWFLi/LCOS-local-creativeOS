import { randomUUID } from 'node:crypto'

import type {
  AcceptArtifactReturnInput,
  AcceptArtifactReturnResult,
  RejectArtifactReturnResult,
  RetryRunInput,
  RetryRunResult,
  RunReview,
} from '@local-creative-os/contracts'
import type { ArtifactReturnId, Run, RunId, RuntimeDispatch } from '@local-creative-os/domain'

import { RuntimeLifecycleConflictError, SqliteMetadataRepository } from './metadata-repository.js'

export class RuntimeReviewService {
  constructor(
    private readonly repository: SqliteMetadataRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: () => string = randomUUID,
  ) {}

  getRunReview(runId: RunId): RunReview {
    const run = this.repository.getRun(runId)
    const dispatch = this.repository.getRuntimeDispatch(runId)
    if (run === undefined || dispatch === undefined) throw new RuntimeLifecycleConflictError('Run review not found.')
    const binding = this.repository.getRuntimeBinding(runId)
    const returns = this.repository.getArtifactReturns(runId)
    const draftRevisions = returns.flatMap((artifactReturn) => {
      if (artifactReturn.draftRevisionId === undefined) return []
      const revision = this.repository.getArtifactRevision(String(artifactReturn.draftRevisionId))
      return revision === undefined ? [] : [revision]
    })
    const pending = returns.some((artifactReturn) => artifactReturn.status === 'pending_review')
    const disabledReason = pending ? undefined : 'no_pending_artifact_return'
    return {
      run,
      dispatch,
      ...(binding === undefined ? {} : { binding }),
      returns,
      draftRevisions,
      presentationPhase: pending ? 'review' : run.status,
      capabilities: {
        schemaVersion: 1,
        accept: { enabled: pending, ...(disabledReason === undefined ? {} : { reason: disabledReason }) },
        reject: { enabled: pending, ...(disabledReason === undefined ? {} : { reason: disabledReason }) },
        retry: { enabled: pending, ...(disabledReason === undefined ? {} : { reason: disabledReason }) },
      },
    }
  }

  accept(returnId: ArtifactReturnId, input: AcceptArtifactReturnInput): AcceptArtifactReturnResult {
    return this.repository.acceptArtifactReturn(returnId, input.expectedBaseRevisionId, this.now())
  }

  reject(returnId: ArtifactReturnId): RejectArtifactReturnResult {
    return this.repository.rejectArtifactReturn(returnId, this.now())
  }

  retry(returnId: ArtifactReturnId, input: RetryRunInput = {}): RetryRunResult {
    const artifactReturn = this.repository.getArtifactReturn(returnId)
    const previousRun = artifactReturn === undefined ? undefined : this.repository.getRun(artifactReturn.runId)
    if (artifactReturn === undefined || previousRun === undefined) {
      throw new RuntimeLifecycleConflictError('Retry lifecycle evidence is incomplete.')
    }
    const timestamp = this.now()
    const suffix = this.createId()
    const run: Run = {
      id: `run-${suffix}` as Run['id'],
      projectId: previousRun.projectId,
      ...(previousRun.workspaceId === undefined ? {} : { workspaceId: previousRun.workspaceId }),
      ...(previousRun.targetArtifactId === undefined ? {} : { targetArtifactId: previousRun.targetArtifactId }),
      ...(previousRun.targetRevisionId === undefined ? {} : { targetRevisionId: previousRun.targetRevisionId }),
      contextManifestId: previousRun.contextManifestId,
      retryOfRunId: previousRun.id,
      provider: previousRun.provider,
      requestedProvider: previousRun.requestedProvider,
      outputIntent: previousRun.outputIntent,
      returnGroupId: `return-group-${suffix}`,
      status: 'created',
      instruction: input.instruction?.trim() || previousRun.instruction,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const dispatch: RuntimeDispatch = {
      id: `dispatch-${suffix}` as RuntimeDispatch['id'],
      runId: run.id,
      provider: run.provider,
      idempotencyKey: String(run.id),
      status: 'planned',
      attemptCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    return this.repository.retryArtifactReturn(returnId, run, dispatch, timestamp)
  }
}
