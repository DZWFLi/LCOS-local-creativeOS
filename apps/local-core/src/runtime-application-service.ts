import { randomUUID } from 'node:crypto'

import type { RunReview } from '@local-creative-os/contracts'
import type { ProjectId, Run, RunId, RuntimeDispatch } from '@local-creative-os/domain'

import { ContextManifestService } from './context-manifest-service.js'
import { SqliteMetadataRepository } from './metadata-repository.js'
import { RuntimeAdapterError, RuntimeAdapterService, type RuntimeProviderError } from './runtime-adapter.js'
import { RuntimeResultIngestionService } from './runtime-result-ingestion.js'
import { RuntimeReviewService } from './runtime-review-service.js'
import { ResourceMatcher } from './resources/resource-matcher.js'

export interface CreateRuntimeRunInput {
  readonly instruction: string
  readonly targetArtifactId: string
  readonly contextArtifactIds?: readonly string[]
  readonly workspaceId?: string
}

export interface RuntimeRunActionResult {
  readonly review: RunReview
  readonly providerError?: RuntimeProviderError
}

export class RuntimeApplicationService {
  constructor(
    private readonly repository: SqliteMetadataRepository,
    private readonly manifests: ContextManifestService,
    private readonly adapter: RuntimeAdapterService,
    private readonly ingestion: RuntimeResultIngestionService,
    private readonly review: RuntimeReviewService,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: () => string = randomUUID,
    private readonly matcher: ResourceMatcher = new ResourceMatcher(),
  ) {}

  async create(projectId: ProjectId, input: CreateRuntimeRunInput): Promise<RuntimeRunActionResult> {
    const instruction = input.instruction.trim()
    if (instruction.length === 0) throw new Error('Run instruction is required.')
    const descriptors = this.repository.listResourceDescriptors(String(projectId))
    const policyByResourceId = new Map(descriptors.map((descriptor) => [
      descriptor.resourceId,
      this.repository.getResourcePolicy(String(projectId), descriptor.resourceId) ?? { approvedContext: false, executable: false },
    ]))
    const matches = this.matcher.match(descriptors, {
      projectId: String(projectId),
      instruction,
      outputIntent: 'revise',
      limit: 8,
    }, {
      ...(input.contextArtifactIds === undefined ? {} : { activeContextArtifactIds: input.contextArtifactIds }),
      policyByResourceId,
    })
    const resourceRefs = this.matcher.toManifestRefs(matches.filter((match) => match.layer !== 'suggested'), descriptors)
    const manifest = await this.manifests.build(projectId, {
      targetArtifactId: input.targetArtifactId,
      ...(input.contextArtifactIds === undefined ? {} : { contextArtifactIds: input.contextArtifactIds }),
      requestedOutput: 'Markdown Script Revision',
      ...(resourceRefs.length === 0 ? {} : { resourceRefs }),
    })
    if (manifest.target === null || manifest.currentRevision === null) {
      throw new Error('Run target must have a Current Revision.')
    }
    const timestamp = this.now()
    const suffix = this.createId()
    const run: Run = {
      id: `run-${suffix}` as Run['id'],
      projectId,
      ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId as NonNullable<Run['workspaceId']> }),
      targetArtifactId: manifest.target.artifactId as Run['targetArtifactId'],
      targetRevisionId: manifest.currentRevision.revisionId as Run['targetRevisionId'],
      contextManifestId: manifest.id,
      provider: 'workbuddy',
      status: 'created',
      instruction,
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
    this.repository.createRunWithDispatch(run, dispatch)
    return this.dispatch(run.id)
  }

  async dispatch(runId: RunId): Promise<RuntimeRunActionResult> {
    return this.providerAction(runId, () => this.adapter.dispatch(runId))
  }

  async recover(runId: RunId): Promise<RuntimeRunActionResult> {
    return this.providerAction(runId, () => this.adapter.recover(runId))
  }

  async sync(runId: RunId): Promise<RuntimeRunActionResult> {
    return this.providerAction(runId, async () => {
      await this.adapter.sync(runId)
      await this.ingestion.ingestFromBridge(runId)
    })
  }

  async finalize(
    runId: RunId,
    decision: 'completed' | 'retrying',
    comment?: string,
  ): Promise<RuntimeRunActionResult> {
    return this.providerAction(runId, () => this.adapter.finalize(runId, decision, comment))
  }

  getProjectReviews(projectId: ProjectId, limit = 20): readonly RunReview[] {
    return this.repository.getProjectRuns(projectId, limit)
      .map((run) => this.review.getRunReview(run.id))
  }

  private async providerAction(runId: RunId, action: () => Promise<unknown>): Promise<RuntimeRunActionResult> {
    try {
      await action()
      return { review: this.review.getRunReview(runId) }
    } catch (error: unknown) {
      if (!(error instanceof RuntimeAdapterError)) throw error
      return {
        review: this.review.getRunReview(runId),
        providerError: error.detail,
      }
    }
  }
}
