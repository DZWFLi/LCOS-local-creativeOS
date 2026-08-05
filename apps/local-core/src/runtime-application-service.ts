import { randomUUID } from 'node:crypto'

import type { AnswerRunInputRequestV1, RunReview } from '@local-creative-os/contracts'
import type { JsonValue, ProjectId, Run, RunEvent, RunId, RunResultPolicy, RuntimeDispatch } from '@local-creative-os/domain'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'

import { ContextManifestService } from './context-manifest-service.js'
import { SqliteMetadataRepository } from './metadata-repository.js'
import { RuntimeAdapterError, RuntimeAdapterService, type RuntimeProviderError } from './runtime-adapter.js'
import { RuntimeResultIngestionService } from './runtime-result-ingestion.js'
import { RuntimeReviewService } from './runtime-review-service.js'
import { ResourceMatcher } from './resources/resource-matcher.js'

export interface CreateRuntimeRunInput {
  readonly instruction: string
  readonly targetArtifactId?: string
  readonly targetRevisionId?: string
  readonly contextArtifactIds?: readonly string[]
  readonly workspaceId?: string
  readonly outputIntent: 'create' | 'revise' | 'analyze'
  readonly resultPolicy?: RunResultPolicy
  readonly requestedProvider?: 'workbuddy' | 'codex' | 'auto'
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
    const outputIntent = input.outputIntent
    if (outputIntent === undefined) throw new Error('Run outputIntent is required (create|revise|analyze).')
    if (outputIntent !== 'revise' && input.targetArtifactId !== undefined) {
      throw new Error(`${outputIntent} 不允许指定修改目标；只有 revise 可以绑定 Target。`)
    }
    if (outputIntent === 'revise' && input.targetArtifactId === undefined) throw new Error('Revise Run requires an explicit target Artifact.')
    if (outputIntent !== 'revise' && input.targetRevisionId !== undefined) {
      throw new Error(`${outputIntent} 不允许指定 Base Revision；只有 revise 可以绑定 Base Revision。`)
    }
    if (outputIntent === 'revise' && input.targetArtifactId !== undefined) {
      const target = this.repository.getArtifact(String(input.targetArtifactId))
      if (target !== undefined && target.managed === false) {
        throw new Error('外部 Reference 不能作为修改目标；只有受管 Artifact 可以 revise。')
      }
    }
    if (outputIntent === 'analyze' && input.resultPolicy !== undefined
      && !['reply_only', 'create_artifact'].includes(input.resultPolicy.type)) {
      throw new Error('analyze 的结果去向只能是直接回复或创建分析 Artifact。')
    }
    if (outputIntent === 'create' && input.resultPolicy !== undefined
      && !['create_artifact', 'create_collection'].includes(input.resultPolicy.type)) {
      throw new Error('create 的结果去向只能是新建 Artifact 或内容集合。')
    }
    if (outputIntent === 'revise' && input.resultPolicy !== undefined
      && input.resultPolicy.type !== 'draft_revision_per_target') {
      throw new Error('revise 的结果去向只能是每个目标生成新 Draft Revision。')
    }
    const descriptors = this.repository.listResourceDescriptors(String(projectId))
    const policyByResourceId = new Map(descriptors.map((descriptor) => [
      descriptor.resourceId,
      this.repository.getResourcePolicy(String(projectId), descriptor.resourceId) ?? { approvedContext: false, executable: false },
    ]))
    const matches = this.matcher.match(descriptors, {
      projectId: String(projectId),
      instruction,
      outputIntent,
      limit: 8,
    }, {
      ...(input.contextArtifactIds === undefined ? {} : { activeContextArtifactIds: input.contextArtifactIds }),
      policyByResourceId,
    })
    const resourceRefs = this.matcher.toManifestRefs(matches.filter((match) => match.layer !== 'suggested'), descriptors)
    const manifest = await this.manifests.build(projectId, {
      ...(input.targetArtifactId === undefined ? {} : { targetArtifactId: input.targetArtifactId }),
      ...(input.targetRevisionId === undefined ? {} : { targetRevisionId: input.targetRevisionId }),
      ...(input.contextArtifactIds === undefined ? {} : { contextArtifactIds: input.contextArtifactIds }),
      requestedOutput: 'Markdown Script Revision',
      ...(resourceRefs.length === 0 ? {} : { resourceRefs }),
    })
    if (outputIntent === 'revise' && (manifest.target === null || manifest.currentRevision === null)) {
      throw new Error('Run target must have a Current Revision.')
    }
    const timestamp = this.now()
    const suffix = this.createId()
    const requestedProvider = input.requestedProvider ?? 'workbuddy'
    const autoProvider = (await this.providers()).find((entry) =>
          entry.executionMode === 'automatic' && entry.availability === 'ready'
          && (entry.provider === 'codex' || entry.provider === 'workbuddy'))
    const provider: Run['provider'] = requestedProvider === 'auto'
      ? (autoProvider?.provider === 'codex' ? 'codex' : 'workbuddy')
      : requestedProvider
    const run: Run = {
      id: `run-${suffix}` as Run['id'],
      projectId,
      ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId as NonNullable<Run['workspaceId']> }),
      ...(manifest.target === null ? {} : { targetArtifactId: manifest.target.artifactId as NonNullable<Run['targetArtifactId']> }),
      ...(manifest.currentRevision === null ? {} : { targetRevisionId: manifest.currentRevision.revisionId as NonNullable<Run['targetRevisionId']> }),
      contextManifestId: manifest.id,
      provider,
      requestedProvider: provider,
      outputIntent,
      returnGroupId: `return-group-${suffix}`,
      ...(input.resultPolicy === undefined ? {} : { resultPolicy: input.resultPolicy }),
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
    this.emit(run.id, 'run.queued', { outputIntent, projectId: String(projectId) })
    return { review: this.review.getRunReview(run.id) }
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

  async cancel(runId: RunId): Promise<RuntimeRunActionResult> {
    return this.providerAction(runId, () => this.adapter.cancel(runId))
  }

  async answerInput(runId: RunId, input: AnswerRunInputRequestV1): Promise<RuntimeRunActionResult> {
    const current = this.repository.getRunInputRequest(input.requestId)
    if (current === undefined || current.runId !== String(runId)) throw new Error('INPUT_REQUEST_NOT_FOUND')
    if (current.status === 'answered') return { review: this.review.getRunReview(runId) }
    if (current.status !== 'pending') throw new Error('INPUT_REQUEST_NOT_PENDING')
    const selectedOptions = [...new Set(input.selectedOptions ?? [])]
    if (selectedOptions.some((option) => !current.options.includes(option))) throw new Error('INPUT_OPTION_INVALID')
    const answerText = input.text?.trim()
    if (answerText && !current.allowFreeText) throw new Error('FREE_TEXT_NOT_ALLOWED')
    if (!answerText && selectedOptions.length === 0) throw new Error('INPUT_RESPONSE_EMPTY')

    const result = await this.providerAction(runId, () => this.adapter.answerInput(runId, {
      requestId: input.requestId,
      ...(answerText ? { text: answerText } : {}),
      selectedOptions,
    }))
    if (result.providerError === undefined) {
      const answeredAt = this.now()
      this.repository.answerRunInputRequest(runId, {
        requestId: input.requestId,
        ...(answerText ? { text: answerText } : {}),
        selectedOptions,
      }, answeredAt)
      this.emit(runId, 'run.input_resolved', { requestId: input.requestId, projectId: String(result.review.run.projectId) })
      this.emit(runId, 'run.queued', { resumedFromInput: true, projectId: String(result.review.run.projectId) })
      return { review: this.review.getRunReview(runId) }
    }
    return result
  }

  async providers(): Promise<readonly RuntimeProviderStatus[]> {
    return this.adapter.providersStatus()
  }

  async getCodexTaskState(runId: RunId): Promise<{ readonly status?: string; readonly leaseExpiresAt?: string } | undefined> {
    return this.adapter.getCodexTaskState(runId)
  }

  getProjectReviews(projectId: ProjectId, limit = 20): readonly RunReview[] {
    return this.repository.getProjectRuns(projectId, limit)
      .map((run) => this.review.getRunReview(run.id))
  }

  private async providerAction(runId: RunId, action: () => Promise<unknown>): Promise<RuntimeRunActionResult> {
    try {
      const before = this.review.getRunReview(runId)
      await action()
      const review = this.review.getRunReview(runId)
      if (before.run.status !== 'running' && review.run.status === 'running') {
        this.emit(runId, 'run.started', { projectId: String(review.run.projectId) })
      }
      if (before.run.status !== 'waiting_input' && review.run.status === 'waiting_input') {
        const inputRequest = review.inputRequest
        this.emit(runId, 'run.waiting_input', {
          projectId: String(review.run.projectId),
          ...(inputRequest === undefined ? {} : { requestId: inputRequest.requestId, question: inputRequest.question }),
        })
      }
      if (before.presentationPhase !== 'review' && review.presentationPhase === 'review') {
        this.emit(runId, 'run.review_ready', { projectId: String(review.run.projectId) })
      }
      if (before.run.status !== 'completed' && review.run.status === 'completed') {
        this.emit(runId, 'run.completed', { projectId: String(review.run.projectId) })
      }
      if (before.run.status !== 'cancelled' && review.run.status === 'cancelled') {
        this.emit(runId, 'run.cancelled', { projectId: String(review.run.projectId) })
      }
      if (before.run.status !== 'failed' && review.run.status === 'failed') {
        this.emit(runId, 'run.failed', { projectId: String(review.run.projectId) })
      }
      return { review }
    } catch (error: unknown) {
      if (!(error instanceof RuntimeAdapterError)) throw error
      return {
        review: this.review.getRunReview(runId),
        providerError: error.detail,
      }
    }
  }

  private emit(runId: RunId, type: RunEvent['type'], payload: JsonValue = {}): void {
    this.repository.createRunEvent({
      id: `event-${randomUUID()}` as RunEvent['id'],
      runId,
      type,
      payload,
      occurredAt: this.now(),
    })
  }
}
