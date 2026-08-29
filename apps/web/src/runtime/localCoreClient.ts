import type {
  AcceptArtifactReturnInput,
  AcceptArtifactReturnResult,
  AgentExecutionPlanV1,
  BoundaryEvaluationRequestV1,
  BoundaryEvaluationResultV1,
  BranchSnapshotResultV1,
  CaptureMaterializeResultV1,
  CaptureSpaceOrganizeResultV1,
  CaptureSpacePayloadPreviewV1,
  CaptureSpacePresentationV1,
  CaptureSpaceSnapshotV1,
  CaptureStagingItemV0,
  Checkpoint,
  ContractError,
  CommandDraftV1,
  ConversationReachResultV0,
  CreateResultSlotInputV0,
  ContextChangeProposalV1,
  ProviderSessionBindingV1,
  ConnectedConversationV1,
  ActiveReceiverIdentityV1,
  ArtifactBirthProvenanceV1,
  ConversationIdentityChainV1,
  SessionPhase,
  ProjectHandoffPackV1,
  ProjectReceiverBindingV1,
  ContextManifestV0,
  ContinuityAttachBundleV1,
  ContinuityResolveRequestV1,
  ContinuityResolveResultV1,
  ContinuityResumeSnapshotV1,
  ContinuityReturnIntakeV1,
  ContinuityReturnReceiptV1,
  BindContinuitySessionV1,
  ConversationExportV1,
  ConversationImportSessionV1,
  ConversationMessageV1,
  ConversationProjectionV1,
  ConversationSearchHitV1,
  ConversationSectionAnnotationV1,
  ConversationSectionV1,
  ConversationSemanticIndexStatusV1,
  PresentationViewV0,
  ConversationSessionV1,
  CompleteConversationImportResultV1,
  HealthStatus,
  HandoffArtifactRef,
  HandoffRecord,
  HandoffResumeMode,
  MetadataStoreStatus,
  MutationBatch,
  MutationChangeSetV1,
  MutationResult,
  MutationReceipt,
  ProjectEventOrigin,
  ProjectCatalogEntry,
  ProjectGraphSnapshot,
  ProjectEventEnvelope,
  ProjectEventReconnectV1,
  ProjectEventSnapshotV1,
  ProcessProjectionV1Item,
  PreviewRecord,
  PrepareRevisionRequestV1,
  PreparedRevisionWorkflowV1,
  RejectArtifactReturnResult,
  ImportResourceResultV1,
  ImportBatchRefV1,
  RecordImportBatchRequestV1,
  IntelligenceStatusV0,
  AttentionRuntimeSnapshotV0,
  IntentTypeV0,
  ObsidianVaultScanV1,
  OcrResultV1,
  ProjectViewRailOrderV0,
  ProjectViewRailRefV0,
  ResourceDescriptorV0,
  Result,
  SearchResultVNext,
  SearchQueryVNext,
  RetryRunInput,
  RetryRunResult,
  RunEvent,
  RunReview,
  RunInputRequestV1,
  RunProposalResult,
  ReorganizePreviewV0,
  ReorganizeProposalV0,
  Relation,
  RuntimeProviderStatus,
  OrderedRunReferenceV2,
  ResultSlotV0,
  RunReceiverRefV1,
  RunRecipeV0,
  SnapshotCompareResultV1,
  ValidatedProjectRoot,
  WorkspaceMembership,
  WorkspaceMembershipSource,
  AssemblyApplyRequestV1,
  AssemblyApplyResultV1,
  ProjectSummaryV1,
  ProjectVisualProfileV0,
  SkillCatalogEntryV1,
  SkillCatalogReadV1,
  UpsertProjectVisualProfileInputV0,
  WarehouseQueryV1,
  WarehouseSnapshotV1,
  NavigationResolutionV0,
  SpatialMarkerIntentV0,
  SpatialMarkerScopeV0,
  SpatialMarkerTargetRefV0,
  StableSurfaceRefV0,
} from '@local-creative-os/contracts'
import { nextMutationOrigin } from './mutationIdentity'
import { getDesktopPort } from './desktopPort'

export const LOCAL_CORE_API_PREFIX = '/api/local-core/v1'
export const LOCAL_CORE_REQUEST_TIMEOUT_MS = 2_500
// 写请求（保存/变异）允许更长的等待：读请求保持 2.5s 快速失败，
// 但保存可能因浏览器到 dev 代理的连接池排队（多标签页 + SSE 长连接）而稍慢，
// 2.5s 会导致真实保存被误报为超时。
export const LOCAL_CORE_WRITE_TIMEOUT_MS = 10_000

export interface RuntimeCall<Value> {
  readonly result: Result<Value>
  readonly origin: 'runtime'
  readonly latencyMs: number
  readonly requestedAt: string
}

export interface StructuredTestReport {
  readonly numTotalTestSuites?: number
  readonly numPassedTestSuites?: number
  readonly numFailedTestSuites?: number
  readonly numTotalTests?: number
  readonly numPassedTests?: number
  readonly numFailedTests?: number
  readonly startTime?: number
  readonly success?: boolean
  readonly testResults?: readonly unknown[]
}

export interface GeneratePreviewResult {
  readonly record: PreviewRecord
  readonly reused: boolean
}

export interface PreviewContentResult {
  readonly previewRecordId: string
  readonly mimeType: string
  readonly size: number
  readonly encoding: 'base64'
  readonly data: string
}

export interface ImportCopyResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact: ProjectGraphSnapshot['artifacts'][number]
  readonly revision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly view: ProjectGraphSnapshot['artifactViews'][number]
  readonly reused: boolean
}

export interface FileObservationResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact?: ProjectGraphSnapshot['artifacts'][number]
  readonly previousAvailability: ProjectGraphSnapshot['fileRecords'][number]['availability']
  readonly changed: boolean
  readonly revisionCreated: false
}

export interface AdoptExternalChangeResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact: ProjectGraphSnapshot['artifacts'][number]
  readonly previousRevision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly revision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly updatedViews: readonly ProjectGraphSnapshot['artifactViews'][number][]
}

export interface CreateRuntimeRunInput {
  readonly instruction: string
  readonly targetArtifactId?: string
  readonly targetRevisionId?: string
  readonly contextArtifactIds?: readonly string[]
  readonly savedContextId?: string
  readonly workspaceId?: string
  readonly outputIntent: 'create' | 'revise' | 'analyze'
  readonly requestedProvider?: string
  readonly sessionId?: string
  readonly receiverRef?: RunReceiverRefV1
  readonly orderedReferences?: readonly OrderedRunReferenceV2[]
  readonly resultSlotId?: string
  readonly resultPolicy?: {
    readonly type: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
    readonly format?: string
  }
}

export interface RuntimeRunActionResult {
  readonly review: RunReview
  readonly providerError?: {
    readonly code: string
    readonly message: string
    readonly retryable: boolean
    readonly provider: 'workbuddy'
  }
}

export interface ActiveContextProjection {
  readonly projectId: string
  readonly workspaceId: string | null
  readonly scopeId: string | null
  readonly selectedViewIds: readonly string[]
  readonly selectionOrder?: readonly string[]
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number; readonly visibleViewIds: readonly string[] }
  readonly nodes?: readonly {
    readonly viewId: string; readonly artifactId: string; readonly revisionId?: string
    readonly title: string; readonly kind: string; readonly managed?: boolean
    readonly x: number; readonly y: number; readonly width: number; readonly height: number
    readonly status?: string; readonly summary?: string
  }[]
  readonly relations?: readonly { readonly id: string; readonly sourceArtifactId: string; readonly targetArtifactId: string; readonly kind: string }[]
  readonly offscreenClusters?: readonly { readonly key: string; readonly scopeId: string; readonly kind: string; readonly count: number; readonly viewIds: readonly string[]; readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } }[]
  readonly recentChanges?: readonly { readonly version: number; readonly kind: 'selection' | 'context' | 'target' | 'viewport' | 'lock' | 'surface' | 'harness' | 'intent'; readonly summary: string; readonly viewIds?: readonly string[]; readonly occurredAt: string; readonly updatedBy: 'web' | 'codex' | 'core' }[]
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
  readonly lockedContextIds?: readonly string[]
  readonly currentSurface?: string
  readonly currentHarness?: string
  readonly explicitIntent?: { readonly type: IntentTypeV0; readonly goal?: string }
  readonly dismissedContinuityKeys?: readonly string[]
  readonly version: number
  readonly updatedAt: string
  readonly targetArtifactId?: string
  readonly targetRevisionId?: string
  readonly selectedArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
  readonly contextArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
}

export interface SessionLifecycleRecordProjectionV1 {
  readonly projectId: string
  readonly provider: 'codex' | 'workbuddy' | string
  readonly phase: SessionPhase
  readonly staleFrom?: Exclude<SessionPhase, 'stale'>
  readonly lastTransitionReason?: string
  readonly updatedAt: string
}

export interface LocalCoreClient {
  health(signal?: AbortSignal): Promise<RuntimeCall<HealthStatus>>
  catalog(signal?: AbortSignal): Promise<RuntimeCall<readonly ProjectCatalogEntry[]>>
  runtimeRegistry(signal?: AbortSignal): Promise<RuntimeCall<{ readonly schemaVersion: 0; readonly recentProjects: readonly { readonly projectId: string; readonly rootPath?: string; readonly displayTitle?: string; readonly lastOpenedAt?: string; readonly lastFocusedAt?: string }[]; readonly lastFocusedProjectId?: string; readonly pinnedCaptureProjectId?: string }>>
  runtimeFocusProject(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  setPinnedCaptureProject(projectId: string | null, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  revealProject(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly projectId: string; readonly revealed: boolean }>>
  updateEntityTitle(entity: 'project' | 'workspace' | 'artifact' | 'scope', id: string, input: { readonly title: string; readonly mode: 'auto' | 'manual' | 'locked'; readonly generatedBy?: string }, signal?: AbortSignal): Promise<RuntimeCall<{ readonly id: string; readonly entity: string; readonly title: string; readonly mode: string }>>
  localIntelligence(signal?: AbortSignal): Promise<RuntimeCall<IntelligenceStatusV0>>
  boundaryEvaluate(projectId: string, input: BoundaryEvaluationRequestV1, signal?: AbortSignal): Promise<RuntimeCall<BoundaryEvaluationResultV1>>
  attentionRuntime(projectId: string, input?: { readonly workspaceId?: string | null; readonly explicitAction?: string; readonly tokenBudget?: number; readonly expandViewIds?: readonly string[]; readonly fullViewIds?: readonly string[]; readonly intentPolicy?: 'rules_only' | 'allow_model' }, signal?: AbortSignal): Promise<RuntimeCall<AttentionRuntimeSnapshotV0>>
  /** @deprecated S9: internal/debug Core capability; normal Web selection uses rule-driven Attention. */
  setAttentionIntent(projectId: string, workspaceId: string | null, intent: { readonly type: IntentTypeV0; readonly goal?: string } | null, signal?: AbortSignal): Promise<RuntimeCall<ActiveContextProjection>>
  /** @deprecated S9: internal/debug path; no 0.1 GUI consumer. */
  dismissContinuityCandidate(projectId: string, workspaceId: string | null, key: string, signal?: AbortSignal): Promise<RuntimeCall<ActiveContextProjection>>
  captureStaging(recentMs?: number, options?: { readonly search?: string; readonly kind?: string; readonly sourceDomain?: string; readonly limit?: number; readonly cursor?: string }, signal?: AbortSignal): Promise<RuntimeCall<{ readonly items: readonly CaptureStagingItemV0[]; readonly pendingCount: number; readonly nextCursor?: string }>>
  captureSpace(signal?: AbortSignal): Promise<RuntimeCall<CaptureSpaceSnapshotV1>>
  saveCaptureSpacePresentation(input: Omit<CaptureSpacePresentationV1, 'version' | 'updatedAt'>, expectedVersion: number, signal?: AbortSignal): Promise<RuntimeCall<CaptureSpacePresentationV1>>
  organizeCaptureSpace(signal?: AbortSignal): Promise<RuntimeCall<CaptureSpaceOrganizeResultV1>>
  captureSpacePreview(captureId: string, signal?: AbortSignal): Promise<RuntimeCall<CaptureSpacePayloadPreviewV1>>
  materializeCaptureToProject(captureIds: readonly string[], projectId: string, signal?: AbortSignal): Promise<RuntimeCall<CaptureMaterializeResultV1>>
  createProjectFromStaging(captureIds: readonly string[], signal?: AbortSignal): Promise<RuntimeCall<{ readonly projectId: string; readonly name: string; readonly rootPath: string; readonly imported: number }>>
  ocr(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<OcrResultV1>>
  viewRailOrder(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectViewRailOrderV0>>
  saveViewRailOrder(projectId: string, orderedRefs: readonly ProjectViewRailRefV0[], expectedVersion: number, signal?: AbortSignal): Promise<RuntimeCall<ProjectViewRailOrderV0>>
  affinityResolve(input: { readonly explicitProjectId?: string; readonly sessionId?: string; readonly localPath?: string; readonly browser?: { readonly profileId?: string; readonly tabId?: number; readonly url?: string }; readonly capturedAt: string }, signal?: AbortSignal): Promise<RuntimeCall<{ readonly projectId?: string; readonly confidence: number; readonly reason: string; readonly candidates?: readonly { readonly projectId: string; readonly score: number; readonly reason: string }[] }>>
  continuityResolve(input: ContinuityResolveRequestV1, signal?: AbortSignal): Promise<RuntimeCall<ContinuityResolveResultV1>>
  continuityResume(projectId: string, input?: { readonly workspaceId?: string | null; readonly sessionId?: string; readonly explicitAction?: string; readonly tokenBudget?: number }, signal?: AbortSignal): Promise<RuntimeCall<ContinuityResumeSnapshotV1>>
  bindContinuitySession(sessionId: string, input: Omit<BindContinuitySessionV1, 'sessionId'>, signal?: AbortSignal): Promise<RuntimeCall<ContinuityResumeSnapshotV1>>
  continuityAttach(projectId: string, input?: { readonly workspaceId?: string | null; readonly sessionId?: string; readonly provider?: string; readonly explicitAction?: string; readonly tokenBudget?: number }, signal?: AbortSignal): Promise<RuntimeCall<ContinuityAttachBundleV1>>
  continuityReturn(projectId: string, input: ContinuityReturnIntakeV1, signal?: AbortSignal): Promise<RuntimeCall<ContinuityReturnReceiptV1>>
  resolveCaptureStaging(id: string, projectId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly id: string; readonly resolvedProjectId: string }>>
  validateProjectRoot(rootPath: string, signal?: AbortSignal): Promise<RuntimeCall<ValidatedProjectRoot>>
  selectDirectory(title: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly path?: string; readonly cancelled: boolean }>>
  inspectProjectRoot(rootPath: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileCount: number; readonly directoryCount: number; readonly totalBytes: number; readonly skipped: readonly string[]; readonly requiresConfirmation: boolean }>>
  selectObsidianVault(signal?: AbortSignal): Promise<RuntimeCall<ObsidianVaultScanV1 | null>>
  importObsidianNotes(projectId: string, input: {
    readonly scanId: string
    readonly relativePaths: readonly string[]
    readonly scopeId: string
    readonly position: { readonly x: number; readonly y: number }
  }, signal?: AbortSignal): Promise<RuntimeCall<readonly ImportResourceResultV1[]>>
  importResourceUrl(projectId: string, input: {
    readonly url: string
    readonly title?: string
    readonly note?: string
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly importRequestId?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  resourceList(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly {
    readonly resourceId: string
    readonly artifactId: string
    readonly title: string
    readonly sourceKind?: string
    readonly status: string
    readonly analyzerVersion: string
  }[]>>
  resourceDescriptor(projectId: string, resourceId: string, signal?: AbortSignal): Promise<RuntimeCall<ResourceDescriptorV0>>
  resourceReanalyze(projectId: string, resourceId: string, signal?: AbortSignal): Promise<RuntimeCall<ResourceDescriptorV0>>
  resourceRead(projectId: string, resourceId: string, input: {
    readonly path?: string
    readonly limit?: number
  }, signal?: AbortSignal): Promise<RuntimeCall<{
    readonly resourceId: string
    readonly fileName: string
    readonly mimeType?: string
    readonly contentHash?: string
    readonly size: number
    readonly offset: number
    readonly limit: number
    readonly truncated: boolean
    readonly format: string
    readonly data: string
  }>>
  listSpatialMarkers(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly SpatialMarkerIntentV0[]>>
  createSpatialMarker(projectId: string, input: { readonly targetRef: SpatialMarkerTargetRefV0; readonly scope: SpatialMarkerScopeV0; readonly sourceSurfaceRef?: StableSurfaceRefV0 }, signal?: AbortSignal): Promise<RuntimeCall<SpatialMarkerIntentV0>>
  deleteSpatialMarker(projectId: string, markerId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly deleted: true; readonly markerId: string }>>
  resolveNavigationTarget(projectId: string, targetRef: SpatialMarkerTargetRefV0, signal?: AbortSignal): Promise<RuntimeCall<NavigationResolutionV0>>
  importResourceDirectory(projectId: string, input: {
    readonly importRequestId: string
    readonly rootName: string
    readonly files: readonly { readonly path: string; readonly file: File }[]
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly note?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  importResourceArchive(projectId: string, input: {
    readonly file: File
    readonly importRequestId: string
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly note?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  createConversationImportSession(projectId: string, input: { readonly sourceKind: 'codex'; readonly title?: string; readonly sourceFileName: string; readonly expectedBytes?: number; readonly workspaceId?: string; readonly scopeId: string }, signal?: AbortSignal): Promise<RuntimeCall<ConversationImportSessionV1>>
  uploadConversationChunk(projectId: string, importSessionId: string, chunkIndex: number, bytes: Blob, contentHash?: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationImportSessionV1>>
  completeConversationImport(projectId: string, importSessionId: string, input: { readonly expectedChunks: number; readonly expectedContentHash?: string }, signal?: AbortSignal): Promise<RuntimeCall<CompleteConversationImportResultV1>>
  importManualConversation(projectId: string, input: { readonly title?: string; readonly scopeId: string; readonly workspaceId?: string; readonly entries: readonly { readonly role: 'user' | 'assistant' | 'tool' | 'system'; readonly contentText: string; readonly createdAt?: string; readonly toolName?: string }[] }, signal?: AbortSignal): Promise<RuntimeCall<CompleteConversationImportResultV1>>
  conversations(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly ConversationSessionV1[]>>
  conversationProjection(projectId: string, conversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationProjectionV1>>
  exportConversation(projectId: string, conversationId: string, includeMessages?: boolean, signal?: AbortSignal): Promise<RuntimeCall<ConversationExportV1>>
  conversationMessages(projectId: string, conversationId: string, input?: { readonly offset?: number; readonly limit?: number }, signal?: AbortSignal): Promise<RuntimeCall<readonly ConversationMessageV1[]>>
  searchConversations(projectId: string, query: string, input?: { readonly semantic?: boolean; readonly limit?: number }, signal?: AbortSignal): Promise<RuntimeCall<readonly ConversationSearchHitV1[]>>
  updateConversationSection(projectId: string, conversationId: string, sectionId: string, input: { readonly title?: string; readonly lockedByUser?: boolean }, signal?: AbortSignal): Promise<RuntimeCall<ConversationSectionV1>>
  refreshConversationSections(projectId: string, conversationId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly ConversationSectionV1[]>>
  annotateConversationSection(projectId: string, conversationId: string, sectionId: string, input: { readonly sourceHash: string; readonly title: string; readonly decisions: readonly string[]; readonly todos: readonly string[]; readonly involvedFiles: readonly string[]; readonly annotatedBy?: 'agent' | 'user' }, signal?: AbortSignal): Promise<RuntimeCall<ConversationSectionAnnotationV1>>
  pinConversationMessage(projectId: string, conversationId: string, messageId: string, input: { readonly title?: string; readonly summary?: string; readonly scopeId: string; readonly workspaceId?: string; readonly x?: number; readonly y?: number }, signal?: AbortSignal): Promise<RuntimeCall<ConversationMessageV1>>
  conversationSemanticStatus(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationSemanticIndexStatusV1>>
  buildConversationSemanticIndex(projectId: string, input?: { readonly model?: string; readonly sessionId?: string; readonly force?: boolean; readonly batchSize?: number }, signal?: AbortSignal): Promise<RuntimeCall<ConversationSemanticIndexStatusV1>>
  presentationList(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly PresentationViewV0[]>>
  presentationGet(projectId: string, presentationId: string, signal?: AbortSignal): Promise<RuntimeCall<PresentationViewV0>>
  presentationSave(projectId: string, presentationId: string, contract: PresentationViewV0, expectedVersion: number, signal?: AbortSignal, origin?: ProjectEventOrigin): Promise<RuntimeCall<PresentationViewV0>>
  mutationReceipt(projectId: string, operationId: string, runtimeId?: string, signal?: AbortSignal): Promise<RuntimeCall<MutationReceipt>>
  presentationDelete(projectId: string, presentationId: string, signal?: AbortSignal): Promise<RuntimeCall<null>>
  /** @deprecated S9: Web realtime authority is streamProjectEvents(). */
  streamPresentation(projectId: string, presentationId: string, afterVersion: number | undefined, handlers: { readonly onChange?: (value: { readonly presentationId: string; readonly version: number; readonly updatedAt: string; readonly updatedBy: string }) => void }, signal?: AbortSignal): Promise<void>
  /** @deprecated S9: Web realtime authority is streamProjectEvents(). */
  streamProjectPresentations(projectId: string, handlers: { readonly onChange?: (value: { readonly presentationId: string; readonly version: number; readonly updatedAt: string; readonly updatedBy: string }) => void }, signal?: AbortSignal): Promise<void>
  streamProjectEvents(projectId: string, cursor: { readonly runtimeId?: string; readonly lastSeenProjectSeq?: number }, handlers: {
    readonly onSnapshot?: (value: ProjectEventSnapshotV1) => void
    readonly onReplay?: (value: ProjectEventReconnectV1 & { readonly kind: 'replay' }) => void
    readonly onEvent?: (value: ProjectEventEnvelope) => void
  }, signal?: AbortSignal): Promise<void>
  createProject(input: {
    readonly name: string
  } & (
    | { readonly intent: 'create'; readonly parentPath: string; readonly directoryName: string }
    | { readonly intent: 'open'; readonly rootPath: string; readonly importExisting?: boolean }
  ), signal?: AbortSignal): Promise<RuntimeCall<ProjectCatalogEntry>>
  metadataStatus(signal?: AbortSignal): Promise<RuntimeCall<MetadataStoreStatus>>
  projectGraph(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectGraphSnapshot>>
  deleteProject(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<{ deleted: boolean; projectId: string; note?: string }>>
  mergeWorkbench(projectId: string, workbenchScopeId: string, signal?: AbortSignal): Promise<RuntimeCall<{ mergedViews: number; restoredRefs: number; removedViews: number }>>
  createTextArtifact(projectId: string, input: {
    readonly title?: string
    readonly body: string
    readonly scopeId: string
    readonly workspaceId?: string
    readonly x?: number
    readonly y?: number
  }, signal?: AbortSignal): Promise<RuntimeCall<{
    readonly artifactId: string
    readonly revisionId: string
    readonly viewId: string
    readonly fileRecordId: string
    readonly title: string
  }>>
  /** 读取受管 FileRecord 的原始文本内容（SKILL.md 等受管 markdown 读回）。 */
  readFileRecordText(projectId: string, fileRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<string>>
  exportLcosproj(projectId: string, targetPath: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  downloadLcosproj(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileName: string; readonly blob: Blob }>>
  downloadHandoffZip(projectId: string, input?: { readonly targetArtifactId?: string; readonly requestedOutput?: string }, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileName: string; readonly blob: Blob }>>
  exportWorkflow(projectId: string, scopeId?: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileName: string; readonly blob: Blob }>>
  importWorkflow(projectId: string, file: File, scopeId?: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly imported: boolean; readonly members: number; readonly workspaces: number }>>
  openLcosprojUpload(file: File, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  exportAllLcosproj(targetDir: string, projectIds?: readonly string[], signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  openLcosproj(filePath: string, rootPath?: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  inspectLcosproj(filePath: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  workspaceMemberships(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly WorkspaceMembership[]>>
  addWorkspaceMembers(workspaceId: string, input: {
    readonly viewIds: readonly string[]
    readonly addedBy?: WorkspaceMembershipSource
  }, signal?: AbortSignal): Promise<RuntimeCall<readonly WorkspaceMembership[]>>
  removeWorkspaceMember(workspaceId: string, viewId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly WorkspaceMembership[]>>
  moveWorkspaceMember(workspaceId: string, input: {
    readonly viewId: string
    readonly toWorkspaceId: string
  }, signal?: AbortSignal): Promise<RuntimeCall<readonly WorkspaceMembership[]>>
  /** @deprecated S9 for Web: CLI/Agent owns explicit validate-plan; Web uses proposeRun(). */
  validateAgentPlan(projectId: string, plan: Omit<AgentExecutionPlanV1, 'projectId'>, signal?: AbortSignal): Promise<RuntimeCall<AgentExecutionPlanV1>>
  proposeRun(projectId: string, input: {
    readonly workspaceId?: string
    readonly prompt: string
    readonly intent?: 'analyze' | 'create' | 'revise'
    readonly requestedProvider: string | 'auto'
    readonly createAsNewNode?: boolean
    readonly decisionSource?: 'agent' | 'fallback'
    readonly contextItems: readonly { readonly artifactId: string; readonly revisionId: string; readonly order: number }[]
    readonly editTargets: readonly { readonly artifactId: string; readonly baseRevisionId: string }[]
    readonly receiverRef?: RunReceiverRefV1
    readonly orderedReferences?: readonly OrderedRunReferenceV2[]
    readonly resultSlotId?: string
    readonly resultPolicy?: {
      readonly type: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
      readonly format?: string
    }
  }, signal?: AbortSignal): Promise<RuntimeCall<RunProposalResult>>
  runtimeProviders(signal?: AbortSignal): Promise<RuntimeCall<readonly RuntimeProviderStatus[]>>
  changeSets(projectId: string, limit?: number, signal?: AbortSignal): Promise<RuntimeCall<readonly MutationChangeSetV1[]>>
  changeSet(projectId: string, changeSetId: string, signal?: AbortSignal): Promise<RuntimeCall<MutationChangeSetV1>>
  revertChangeSet(projectId: string, changeSetId: string, signal?: AbortSignal): Promise<RuntimeCall<MutationChangeSetV1>>
  reapplyChangeSet(projectId: string, changeSetId: string, signal?: AbortSignal): Promise<RuntimeCall<MutationChangeSetV1>>
  prepareRevisionWorkflow(projectId: string, input: PrepareRevisionRequestV1, signal?: AbortSignal): Promise<RuntimeCall<PreparedRevisionWorkflowV1>>
  relations(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly Relation[]>>
  saveRelation(projectId: string, relation: Relation, signal?: AbortSignal): Promise<RuntimeCall<Relation>>
  deleteRelation(projectId: string, relationId: string, signal?: AbortSignal): Promise<RuntimeCall<null>>
  createReorganizeProposal(projectId: string, input: {
    readonly presentationId: string
    readonly baseVersion: number
    readonly mergeCandidates?: readonly { readonly sourceViewIds: readonly string[]; readonly targetViewId?: string; readonly reason: string }[]
    readonly removeMemberViewIds?: readonly string[]
    readonly layoutIntent?: { readonly engine: 'elk' | 'fcose' | 'manual'; readonly preservePinned: boolean }
    readonly positionPatch?: Readonly<Record<string, { readonly x: number; readonly y: number }>>
  }, signal?: AbortSignal): Promise<RuntimeCall<ReorganizeProposalV0>>
  previewReorganize(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<ReorganizePreviewV0>>
  applyReorganize(projectId: string, proposalId: string, confirmDestructive: boolean, signal?: AbortSignal): Promise<RuntimeCall<ReorganizePreviewV0>>
  acceptReorganize(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<ReorganizeProposalV0>>
  rollbackReorganize(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<ReorganizeProposalV0>>
  rejectReorganize(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<ReorganizeProposalV0>>
  createCheckpoint(projectId: string, input: {
    readonly id: string
    readonly scopeId: string
    readonly label: string
    readonly snapshotJson: unknown
  }, signal?: AbortSignal): Promise<RuntimeCall<{
    readonly id: string
    readonly projectId: string
    readonly scopeId: string
    readonly label: string
    readonly createdAt: string
  }>>
  checkpoints(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly Checkpoint[]>>
  updateActiveContext(projectId: string, input: {
    readonly workspaceId?: string
    readonly scopeId: string
    readonly selectedViewIds: readonly string[]
    readonly pinnedContextIds: readonly string[]
    readonly excludedContextIds: readonly string[]
    readonly lockedContextIds?: readonly string[]
    readonly currentSurface?: string
    readonly currentHarness?: string
    readonly explicitIntent?: { readonly type: IntentTypeV0; readonly goal?: string } | null
    readonly dismissedContinuityKeys?: readonly string[]
    readonly targetArtifactId?: string
    readonly targetRevisionId?: string
    readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number }
    readonly visibleViewIds?: readonly string[]
    readonly expectedVersion?: number
  }, signal?: AbortSignal): Promise<RuntimeCall<ActiveContextProjection>>
  activeContext(projectId: string, workspaceId?: string | null, afterVersion?: number, signal?: AbortSignal): Promise<RuntimeCall<ActiveContextProjection>>
  /**
   * Subscribe to active-context updates over SSE. Resolves once the stream is
   * open; handlers fire for `snapshot`/`update`, `proposals` and `runs` frames.
   * Rejects if the endpoint is unavailable, so callers can fall back to polling.
   */
  /** @deprecated S9: Web realtime authority is streamProjectEvents(); keep route compatibility only. */
  streamActiveContext(
    projectId: string,
    workspaceId: string | null,
    afterVersion: number | undefined,
    handlers: {
      readonly onContext?: (value: ActiveContextProjection) => void
      readonly onProposals?: (value: readonly ContextChangeProposalV1[]) => void
      readonly onRuns?: (value: readonly RunReview[]) => void
    },
    signal?: AbortSignal,
  ): Promise<void>
  getCommandDraft(projectId: string, workspaceId: string | null, composerAnchor: string, signal?: AbortSignal): Promise<RuntimeCall<CommandDraftV1 | null>>
  saveCommandDraft(projectId: string, workspaceId: string | null, composerAnchor: string, input: Omit<CommandDraftV1, 'schemaVersion' | 'projectId' | 'workspaceId' | 'composerAnchor' | 'updatedAt'>, signal?: AbortSignal): Promise<RuntimeCall<CommandDraftV1>>
  deleteCommandDraft(projectId: string, workspaceId: string | null, composerAnchor: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly deleted: boolean }>>
  getProviderSession(projectId: string, provider: 'codex' | 'workbuddy', signal?: AbortSignal): Promise<RuntimeCall<ProviderSessionBindingV1 | null>>
  saveProviderSession(projectId: string, provider: 'codex' | 'workbuddy', input: Omit<ProviderSessionBindingV1, 'projectId' | 'provider' | 'updatedAt'>, signal?: AbortSignal): Promise<RuntimeCall<ProviderSessionBindingV1>>
  deleteProviderSession(projectId: string, provider: 'codex' | 'workbuddy', signal?: AbortSignal): Promise<RuntimeCall<{ readonly deleted: boolean }>>
  // RECEIVER-0 会话承接（契约面；GUI 接线不在 RECEIVER-0 范围内）
  listConnectedConversations(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly ConnectedConversationV1[]>>
  connectConversation(projectId: string, input: { readonly conversationRef: string; readonly executorId: string; readonly provider: 'codex' | 'workbuddy'; readonly label?: string }, signal?: AbortSignal): Promise<RuntimeCall<ConnectedConversationV1>>
  createConnectedConversation(projectId: string, input: { readonly executorId: string; readonly provider: 'codex' | 'workbuddy'; readonly label?: string }, signal?: AbortSignal): Promise<RuntimeCall<ConnectedConversationV1>>
  disconnectConversation(projectId: string, connectedConversationId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly deleted: boolean }>>
  getProjectReceiverBinding(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectReceiverBindingV1>>
  setActiveReceiver(projectId: string, connectedConversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectReceiverBindingV1>>
  activeReceiverIdentity(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ActiveReceiverIdentityV1>>
  connectedConversationIdentity(projectId: string, connectedConversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationIdentityChainV1>>
  linkConnectedConversationSession(projectId: string, connectedConversationId: string, conversationSessionId: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationIdentityChainV1>>
  artifactBirth(projectId: string, artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<ArtifactBirthProvenanceV1>>
  sessionLifecycle(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly states: readonly SessionLifecycleRecordProjectionV1[] }>>
  recoverSessionLifecycle(projectId: string, provider: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly state: SessionLifecycleRecordProjectionV1 }>>
  // RECEIVER-3 会话承接 Handoff（切换时 prepare；发送前读 pending + 注入 + consume）
  prepareReceiverHandoff(projectId: string, input: {
    readonly fromConversationId: string | null
    readonly toConversationId: string
    readonly surface: { readonly kind: 'main' | 'context' | 'workflow'; readonly surfaceId: string }
    readonly selectionEntityIds: readonly string[]
  }, signal?: AbortSignal): Promise<RuntimeCall<ProjectHandoffPackV1>>
  getPendingReceiverHandoff(projectId: string, conversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectHandoffPackV1 | null>>
  consumeReceiverHandoff(projectId: string, conversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectHandoffPackV1 | null>>
  proposeContextChange(projectId: string, input: {
    readonly workspaceId?: string
    readonly baseContextVersion: number
    readonly addViewIds: readonly string[]
    readonly removeViewIds: readonly string[]
    readonly targetViewId?: string
    readonly reason: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ContextChangeProposalV1>>
  acceptContextProposal(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  rejectContextProposal(projectId: string, proposalId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  listContextProposals(projectId: string, workspaceId?: string | null, signal?: AbortSignal): Promise<RuntimeCall<readonly ContextChangeProposalV1[]>>
  artifactSearch(projectId: string, query: string, signal?: AbortSignal): Promise<RuntimeCall<readonly {
    readonly id: string
    readonly title: string
    readonly kind: string
    readonly managed?: boolean
    readonly currentRevisionId?: string
  }[]>>
  projectSearch(projectId: string, query: string, input?: Omit<SearchQueryVNext, 'query'>, signal?: AbortSignal): Promise<RuntimeCall<SearchResultVNext>>
  warehouse(projectId: string, input?: WarehouseQueryV1, signal?: AbortSignal): Promise<RuntimeCall<WarehouseSnapshotV1>>
  applyAssembly(projectId: string, input: Omit<AssemblyApplyRequestV1, 'projectId'>, signal?: AbortSignal): Promise<RuntimeCall<AssemblyApplyResultV1>>
  projectSummary(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectSummaryV1>>
  projectVisualProfile(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectVisualProfileV0 | undefined>>
  saveProjectVisualProfile(projectId: string, input: UpsertProjectVisualProfileInputV0, signal?: AbortSignal): Promise<RuntimeCall<ProjectVisualProfileV0>>
  projectSkills(projectId: string, search?: string, signal?: AbortSignal): Promise<RuntimeCall<readonly SkillCatalogEntryV1[]>>
  projectSkill(projectId: string, skillId: string, signal?: AbortSignal): Promise<RuntimeCall<SkillCatalogReadV1>>
  conversationReach(projectId: string, connectedConversationId: string, signal?: AbortSignal): Promise<RuntimeCall<ConversationReachResultV0>>
  createResultSlot(projectId: string, input: Omit<CreateResultSlotInputV0, 'projectId'>, signal?: AbortSignal): Promise<RuntimeCall<ResultSlotV0>>
  resultSlots(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly ResultSlotV0[]>>
  resultSlot(resultSlotId: string, signal?: AbortSignal): Promise<RuntimeCall<ResultSlotV0>>
  deleteResultSlot(resultSlotId: string, signal?: AbortSignal): Promise<RuntimeCall<null>>
  runRecipe(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RunRecipeV0>>
  artifactDetail(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  revisionList(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly unknown[]>>
  revisionCompare(projectId: string, baseRevisionId: string, headRevisionId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  openArtifactSource(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly opened: boolean; readonly path: string }>>
  revealArtifactSource(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly revealed: boolean; readonly path: string }>>
  artifactSourcePath(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly path: string; readonly exists: boolean; readonly isUrl: boolean }>>
  relinkArtifactSource(artifactId: string, path: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly relinked: boolean; readonly path: string }>>
  resolveArtifactShortcut(artifactId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly shortcutPath: string; readonly resolvedTarget: string | null; readonly targetKind: string; readonly targetExists: boolean }>>
  processProjection(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly ProcessProjectionV1Item[]>>
  saveWorkspaceState(workspaceId: string, name: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  listWorkspaceStates(workspaceId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly unknown[]>>
  restoreWorkspaceState(workspaceId: string, stateId: string, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  createSessionSummary(projectId: string, input: {
    readonly title: string
    readonly summary: string
    readonly runIds?: readonly string[]
    readonly handoffRef?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<unknown>>
  listSessionSummaries(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly unknown[]>>
  previewRecords(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly PreviewRecord[]>>
  previewContent(projectId: string, previewRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<PreviewContentResult>>
  generatePreview(projectId: string, revisionId: string, previewProfile: string, signal?: AbortSignal): Promise<RuntimeCall<GeneratePreviewResult>>
  importCopy(projectId: string, input: { readonly file: File; readonly importRequestId: string; readonly scopeId: string; readonly x: number; readonly y: number }, signal?: AbortSignal): Promise<RuntimeCall<ImportCopyResult>>
  recordImportBatch(projectId: string, input: RecordImportBatchRequestV1, signal?: AbortSignal): Promise<RuntimeCall<ImportBatchRefV1>>
  latestImportBatch(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ImportBatchRefV1 | null>>
  getImportBatch(projectId: string, batchId: string, signal?: AbortSignal): Promise<RuntimeCall<ImportBatchRefV1>>
  buildContextManifest(projectId: string, input?: { readonly targetArtifactId?: string; readonly contextArtifactIds?: readonly string[]; readonly requestedOutput?: string }, signal?: AbortSignal): Promise<RuntimeCall<ContextManifestV0>>
  createRuntimeRun(projectId: string, input: CreateRuntimeRunInput, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  projectRunReviews(projectId: string, limit?: number, signal?: AbortSignal): Promise<RuntimeCall<readonly RunReview[]>>
  runEvents(runId: string, afterSequence?: number, signal?: AbortSignal): Promise<RuntimeCall<readonly RunEvent[]>>
  dispatchRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  recoverRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  cancelRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  getRunInputRequest(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RunInputRequestV1>>
  answerRunInput(runId: string, input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  syncRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  finalizeRuntimeRun(runId: string, decision: 'completed' | 'retrying', comment?: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  getRunReview(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RunReview>>
  acceptArtifactReturn(returnId: string, input: AcceptArtifactReturnInput, signal?: AbortSignal): Promise<RuntimeCall<AcceptArtifactReturnResult>>
  rejectArtifactReturn(returnId: string, signal?: AbortSignal): Promise<RuntimeCall<RejectArtifactReturnResult>>
  retryArtifactReturn(returnId: string, input?: RetryRunInput, signal?: AbortSignal): Promise<RuntimeCall<RetryRunResult>>
  refreshFileRecord(fileRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<FileObservationResult>>
  adoptExternalChange(fileRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<AdoptExternalChangeResult>>
  applyMutations(batch: MutationBatch, projectId: string, signal?: AbortSignal): Promise<RuntimeCall<MutationResult>>
  saveProjectGraph(snapshot: ProjectGraphSnapshot, signal?: AbortSignal): Promise<RuntimeCall<ProjectGraphSnapshot>>
  listContextSnapshots(projectId: string, workspaceId?: string | null, signal?: AbortSignal): Promise<RuntimeCall<readonly Checkpoint[]>>
  createContextSnapshot(projectId: string, input: { readonly label: string; readonly workspaceId?: string }, signal?: AbortSignal): Promise<RuntimeCall<Checkpoint>>
  compareContextSnapshots(projectId: string, snapshotId: string, otherSnapshotId: string, signal?: AbortSignal): Promise<RuntimeCall<SnapshotCompareResultV1>>
  branchContextSnapshot(projectId: string, snapshotId: string, input: { readonly label: string; readonly targetScopeId?: string }, signal?: AbortSignal): Promise<RuntimeCall<BranchSnapshotResultV1>>
  listHandoffs(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly HandoffRecord[]>>
  createHandoff(projectId: string, input: {
    readonly title: string
    readonly resumeMode?: HandoffResumeMode
    readonly fromProvider?: string
    readonly toProvider?: string
    readonly sessionSummaryId?: string
    readonly contextSnapshotId?: string
    readonly decisions?: readonly string[]
    readonly openQuestions?: readonly string[]
    readonly nextActions?: readonly string[]
    readonly artifactRefs?: readonly HandoffArtifactRef[]
    readonly messageRefs?: readonly string[]
  }, signal?: AbortSignal): Promise<RuntimeCall<HandoffRecord>>
  deleteHandoff(projectId: string, handoffId: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly deleted: boolean }>>
}

function runtimeError(
  code: ContractError['code'],
  message: string,
  retryable: boolean,
): ContractError {
  return { code, message, retryable, origin: 'runtime' }
}

function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<HealthStatus>
  return (
    candidate.status === 'ok'
    && candidate.service === 'local-core'
    && (candidate.mode === 'read_only_phase_1a' || candidate.mode === 'phase_2_lite')
    && typeof candidate.version === 'string'
  )
}

function isFailure(value: unknown): value is Extract<Result<never>, { readonly ok: false }> {
  if (typeof value !== 'object' || value === null || !('ok' in value) || value.ok !== false) return false
  if (!('error' in value) || typeof value.error !== 'object' || value.error === null) return false
  const error = value.error as Partial<ContractError>
  return (
    typeof error.code === 'string'
    && typeof error.message === 'string'
    && typeof error.retryable === 'boolean'
    && (error.origin === 'runtime' || error.origin === 'fixture')
  )
}

async function request<Value>(
  path: string,
  options: {
    readonly init?: RequestInit
    readonly signal?: AbortSignal
    readonly timeoutMs?: number
    decode(value: unknown): Result<Value>
  },
): Promise<RuntimeCall<Value>> {
  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  const controller = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? LOCAL_CORE_REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    const headers = new Headers(options.init?.headers)
    headers.set('accept', 'application/json')
    const response = await fetch(`${LOCAL_CORE_API_PREFIX}${path}`, {
      ...options.init,
      signal: controller.signal,
      headers,
    })
    const body: unknown = await response.json()
    const result = options.decode(body)
    if (!response.ok && result.ok) {
      return {
        result: {
          ok: false,
          error: runtimeError('UNAVAILABLE', `Local Core returned HTTP ${response.status}.`, true),
        },
        origin: 'runtime',
        latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
        requestedAt,
      }
    }
    return {
      result,
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      result: {
        ok: false,
        error: runtimeError(
          aborted ? 'ABORTED' : 'UNAVAILABLE',
          timedOut
            ? 'Local Core request timed out.'
            : aborted
              ? 'Local Core request was aborted.'
              : 'Local Core is offline or the development proxy is unavailable.',
          !aborted,
        ),
      },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } finally {
    globalThis.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}


/** 读取纯文本端点（响应体是原始文件内容，非 {ok,value} JSON envelope）。 */
async function requestText(path: string, signal?: AbortSignal): Promise<RuntimeCall<string>> {
  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  const controller = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => { timedOut = true; controller.abort() }, LOCAL_CORE_REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(`${LOCAL_CORE_API_PREFIX}${path}`, {
      signal: controller.signal,
      headers: { accept: 'text/plain, text/markdown, */*' },
    })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const decoded = decodeResult<never>(body)
      return {
        result: decoded.ok ? { ok: false, error: runtimeError('UNAVAILABLE', `Local Core returned HTTP ${response.status}.`, true) } : decoded,
        origin: 'runtime',
        latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
        requestedAt,
      }
    }
    return {
      result: { ok: true, value: await response.text() },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      result: {
        ok: false,
        error: runtimeError(
          aborted ? 'ABORTED' : 'UNAVAILABLE',
          timedOut ? '读取超时。' : aborted ? '读取已取消。' : '本地项目服务暂时不可用。',
          !aborted,
        ),
      },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function requestBlob(path: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileName: string; readonly blob: Blob }>> {
  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  const controller = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => { timedOut = true; controller.abort() }, 120_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(`${LOCAL_CORE_API_PREFIX}${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/vnd.local-creative-os.project, application/octet-stream' },
    })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const decoded = decodeResult<never>(body)
      return {
        result: decoded.ok ? { ok: false, error: runtimeError('UNAVAILABLE', `Local Core returned HTTP ${response.status}.`, true) } : decoded,
        origin: 'runtime',
        latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
        requestedAt,
      }
    }
    const disposition = response.headers.get('content-disposition') ?? ''
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
    const quoted = /filename="([^"]+)"/i.exec(disposition)?.[1]
    let fileName = quoted ?? 'project.lcosproj'
    if (encoded !== undefined) {
      try { fileName = decodeURIComponent(encoded) } catch { /* keep fallback */ }
    }
    return {
      result: { ok: true, value: { fileName, blob: await response.blob() } },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      result: { ok: false, error: runtimeError(aborted ? 'ABORTED' : 'UNAVAILABLE', timedOut ? '工程导出超时。' : aborted ? '工程导出已取消。' : '本地项目服务暂时不可用。', !aborted) },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function decodeHealth(value: unknown): Result<HealthStatus> {
  if (isHealthStatus(value)) return { ok: true, value }
  if (isFailure(value)) return value
  return {
    ok: false,
    error: runtimeError('UNAVAILABLE', 'Local Core health response has an unexpected shape.', false),
  }
}

function decodeResult<Value>(value: unknown): Result<Value> {
  if (isFailure(value)) return value
  if (typeof value === 'object' && value !== null && 'ok' in value && value.ok === true && 'value' in value) {
    return { ok: true, value: value.value as Value }
  }
  return {
    ok: false,
    error: runtimeError('UNAVAILABLE', 'Local Core response has an unexpected shape.', false),
  }
}

export function createLocalCoreClient(): LocalCoreClient {
  return {
    health(signal) {
      return request('/health', { signal, decode: decodeHealth })
    },
    catalog(signal) {
      return request('/projects', {
        signal,
        decode: decodeResult<readonly ProjectCatalogEntry[]>,
      })
    },
    runtimeRegistry(signal) {
      return request('/runtime/registry', { signal, decode: decodeResult<{ readonly schemaVersion: 0; readonly recentProjects: readonly { readonly projectId: string; readonly rootPath?: string; readonly displayTitle?: string; readonly lastOpenedAt?: string; readonly lastFocusedAt?: string }[]; readonly lastFocusedProjectId?: string; readonly pinnedCaptureProjectId?: string }> })
    },
    runtimeFocusProject(projectId, signal) {
      return request(`/runtime/projects/${encodeURIComponent(projectId)}/focus`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' } },
        decode: decodeResult<unknown>,
      })
    },
    setPinnedCaptureProject(projectId, signal) {
      return request('/runtime/registry/capture-target', {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) },
        decode: decodeResult<unknown>,
      })
    },
    revealProject(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reveal`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' } },
        decode: decodeResult<{ readonly projectId: string; readonly revealed: boolean }>,
      })
    },
    updateEntityTitle(entity, id, input, signal) {
      return request(`/entities/${entity}/${encodeURIComponent(id)}/title`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<{ readonly id: string; readonly entity: string; readonly title: string; readonly mode: string }>,
      })
    },
    localIntelligence(signal) {
      return request('/runtime/local-intelligence', { signal, decode: decodeResult<IntelligenceStatusV0> })
    },
    boundaryEvaluate(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/attention/boundary-evaluate`, {
        signal,
        timeoutMs: 7_500,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<BoundaryEvaluationResultV1>,
      })
    },
    attentionRuntime(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/attention/runtime`, {
        signal,
        timeoutMs: 12_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
            ...(input?.explicitAction?.trim() ? { explicitAction: input.explicitAction.trim() } : {}),
            ...(input?.tokenBudget === undefined ? {} : { tokenBudget: input.tokenBudget }),
            ...(input?.expandViewIds === undefined ? {} : { expandViewIds: input.expandViewIds }),
            ...(input?.fullViewIds === undefined ? {} : { fullViewIds: input.fullViewIds }),
          }),
        },
        decode: decodeResult<AttentionRuntimeSnapshotV0>,
      })
    },
    setAttentionIntent(projectId, workspaceId, intent, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/attention/intent`, {
        signal,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId, intent }) },
        decode: decodeResult<ActiveContextProjection>,
      })
    },
    dismissContinuityCandidate(projectId, workspaceId, key, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/attention/candidates/${encodeURIComponent(key)}/dismiss`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }) },
        decode: decodeResult<ActiveContextProjection>,
      })
    },
    captureStaging(recentMs, options, signal) {
      const params = new URLSearchParams()
      if (recentMs !== undefined) params.set('recent', String(recentMs))
      if (options?.search) params.set('search', options.search)
      if (options?.kind) params.set('kind', options.kind)
      if (options?.sourceDomain) params.set('sourceDomain', options.sourceDomain)
      if (options?.limit !== undefined) params.set('limit', String(options.limit))
      if (options?.cursor) params.set('cursor', options.cursor)
      const query = params.toString()
      return request(`/runtime/captures/staging${query ? `?${query}` : ''}`, { signal, decode: decodeResult<{ readonly items: readonly CaptureStagingItemV0[]; readonly pendingCount: number; readonly nextCursor?: string }> })
    },
    captureSpace(signal) {
      return request('/runtime/capture-space', { signal, decode: decodeResult<CaptureSpaceSnapshotV1> })
    },
    saveCaptureSpacePresentation(input, expectedVersion, signal) {
      return request('/runtime/capture-space/presentation', {
        signal,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, expectedVersion }) },
        decode: decodeResult<CaptureSpacePresentationV1>,
      })
    },
    organizeCaptureSpace(signal) {
      return request('/runtime/capture-space/organize', {
        signal,
        timeoutMs: 12_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
        decode: decodeResult<CaptureSpaceOrganizeResultV1>,
      })
    },
    captureSpacePreview(captureId, signal) {
      return request(`/runtime/capture-space/items/${encodeURIComponent(captureId)}/preview`, { signal, decode: decodeResult<CaptureSpacePayloadPreviewV1> })
    },
    materializeCaptureToProject(captureIds, projectId, signal) {
      return request('/runtime/capture-space/materialize', {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ captureIds, projectId }) },
        decode: decodeResult<CaptureMaterializeResultV1>,
      })
    },
    createProjectFromStaging(captureIds, signal) {
      return request('/runtime/captures/create-project', {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ captureIds, titleMode: 'auto' }) },
        decode: decodeResult<{ projectId: string; name: string; rootPath: string; imported: number }>,
      })
    },
    ocr(artifactId, signal) {
      return request('/runtime/ocr', {
        signal,
        timeoutMs: 45_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artifactId }) },
        decode: decodeResult<OcrResultV1>,
      })
    },
    viewRailOrder(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/view-rail-order`, {
        signal,
        decode: decodeResult<ProjectViewRailOrderV0>,
      })
    },
    saveViewRailOrder(projectId, orderedRefs, expectedVersion, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/view-rail-order`, {
        signal,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderedRefs, expectedVersion }) },
        decode: decodeResult<ProjectViewRailOrderV0>,
      })
    },
    affinityResolve(input, signal) {
      return request('/runtime/affinity/resolve', {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<{ readonly projectId?: string; readonly confidence: number; readonly reason: string; readonly candidates?: readonly { readonly projectId: string; readonly score: number; readonly reason: string }[] }>,
      })
    },
    continuityResolve(input, signal) {
      return request('/runtime/continuity/resolve', {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ContinuityResolveResultV1>,
      })
    },
    continuityResume(projectId, input = {}, signal) {
      const params = new URLSearchParams()
      if ('workspaceId' in input) params.set('workspaceId', input.workspaceId ?? '')
      if (input.sessionId) params.set('sessionId', input.sessionId)
      if (input.explicitAction) params.set('explicitAction', input.explicitAction)
      if (input.tokenBudget !== undefined) params.set('tokenBudget', String(input.tokenBudget))
      const query = params.size === 0 ? '' : `?${params.toString()}`
      return request(`/projects/${encodeURIComponent(projectId)}/continuity/resume${query}`, {
        signal,
        timeoutMs: 12_000,
        decode: decodeResult<ContinuityResumeSnapshotV1>,
      })
    },
    bindContinuitySession(sessionId, input, signal) {
      return request(`/runtime/continuity/sessions/${encodeURIComponent(sessionId)}/bind`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: { ...input, sessionId }, origin: nextMutationOrigin('continuity') }),
        },
        decode: decodeResult<ContinuityResumeSnapshotV1>,
      })
    },
    continuityAttach(projectId, input = {}, signal) {
      const params = new URLSearchParams()
      if ('workspaceId' in input) params.set('workspaceId', input.workspaceId ?? '')
      if (input.sessionId) params.set('sessionId', input.sessionId)
      if (input.provider) params.set('provider', input.provider)
      if (input.explicitAction) params.set('explicitAction', input.explicitAction)
      if (input.tokenBudget !== undefined) params.set('tokenBudget', String(input.tokenBudget))
      const query = params.size === 0 ? '' : `?${params.toString()}`
      return request(`/projects/${encodeURIComponent(projectId)}/continuity/attach${query}`, {
        signal,
        timeoutMs: 12_000,
        decode: decodeResult<ContinuityAttachBundleV1>,
      })
    },
    continuityReturn(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/continuity/returns`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input, origin: nextMutationOrigin('continuity-return') }),
        },
        decode: decodeResult<ContinuityReturnReceiptV1>,
      })
    },
    resolveCaptureStaging(id, projectId, signal) {
      return request(`/runtime/captures/${encodeURIComponent(id)}/resolve`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) },
        decode: decodeResult<{ readonly id: string; readonly resolvedProjectId: string }>,
      })
    },
    validateProjectRoot(rootPath, signal) {
      return request('/project-roots/validate', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rootPath }),
        },
        decode: decodeResult<ValidatedProjectRoot>,
      })
    },
    async selectDirectory(title, signal) {
      const desktop = getDesktopPort()
      if (desktop !== undefined) {
        const startedAt = performance.now()
        const requestedAt = new Date().toISOString()
        if (signal?.aborted) {
          return {
            result: { ok: false, error: runtimeError('ABORTED', 'Directory selection was aborted.', false) },
            origin: 'runtime',
            latencyMs: 0,
            requestedAt,
          }
        }
        try {
          const value = await desktop.selectDirectory(title)
          return {
            result: { ok: true, value },
            origin: 'runtime',
            latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
            requestedAt,
          }
        } catch (error: unknown) {
          return {
            result: { ok: false, error: runtimeError('UNAVAILABLE', error instanceof Error ? error.message : 'Desktop directory picker failed.', true) },
            origin: 'runtime',
            latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
            requestedAt,
          }
        }
      }
      return request('/system/select-directory', {
        signal,
        timeoutMs: 5 * 60 * 1_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title }),
        },
        decode: decodeResult<{ readonly path?: string; readonly cancelled: boolean }>,
      })
    },
    inspectProjectRoot(rootPath, signal) {
      return request('/project-roots/inspect', {
        signal,
        timeoutMs: 60_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rootPath }) },
        decode: decodeResult<{ readonly fileCount: number; readonly directoryCount: number; readonly totalBytes: number; readonly skipped: readonly string[]; readonly requiresConfirmation: boolean }>,
      })
    },
    createConversationImportSession(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions`, { signal, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<ConversationImportSessionV1> })
    },
    uploadConversationChunk(projectId, importSessionId, chunkIndex, bytes, contentHash, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions/${encodeURIComponent(importSessionId)}/chunks/${encodeURIComponent(String(chunkIndex))}`, { signal, timeoutMs: 30_000, init: { method: 'PUT', headers: { 'content-type': 'application/octet-stream', ...(contentHash === undefined ? {} : { 'x-content-sha256': contentHash }) }, body: bytes }, decode: decodeResult<ConversationImportSessionV1> })
    },
    completeConversationImport(projectId, importSessionId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/conversation-import-sessions/${encodeURIComponent(importSessionId)}/complete`, { signal, timeoutMs: 120_000, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<CompleteConversationImportResultV1> })
    },
    importManualConversation(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/conversations/import-manual`, { signal, timeoutMs: 120_000, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<CompleteConversationImportResultV1> })
    },
    conversations(projectId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations`, { signal, decode: decodeResult<readonly ConversationSessionV1[]> }) },
    conversationProjection(projectId, conversationId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`, { signal, decode: decodeResult<ConversationProjectionV1> }) },
    exportConversation(projectId, conversationId, includeMessages = true, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/export?includeMessages=${includeMessages ? 'true' : 'false'}`, { signal, timeoutMs: 120_000, decode: decodeResult<ConversationExportV1> }) },
    conversationMessages(projectId, conversationId, input = {}, signal) {
      const params = new URLSearchParams(); if (input.offset !== undefined) params.set('offset', String(input.offset)); if (input.limit !== undefined) params.set('limit', String(input.limit))
      return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages${params.size ? `?${params}` : ''}`, { signal, decode: decodeResult<readonly ConversationMessageV1[]> })
    },
    searchConversations(projectId, queryText, input = {}, signal) {
      const params = new URLSearchParams({ q: queryText }); if (input.semantic !== undefined) params.set('semantic', String(input.semantic)); if (input.limit !== undefined) params.set('limit', String(input.limit))
      return request(`/projects/${encodeURIComponent(projectId)}/conversations/search?${params}`, { signal, timeoutMs: input.semantic ? 30_000 : undefined, decode: decodeResult<readonly ConversationSearchHitV1[]> })
    },
    updateConversationSection(projectId, conversationId, sectionId, input, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/sections/${encodeURIComponent(sectionId)}`, { signal, init: { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<ConversationSectionV1> }) },
    refreshConversationSections(projectId, conversationId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/sections/refresh`, { signal, init: { method: 'POST' }, decode: decodeResult<readonly ConversationSectionV1[]> }) },
    annotateConversationSection(projectId, conversationId, sectionId, input, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/sections/${encodeURIComponent(sectionId)}/annotation`, { signal, timeoutMs: 30_000, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<ConversationSectionAnnotationV1> }) },
    pinConversationMessage(projectId, conversationId, messageId, input, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/pin`, { signal, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<ConversationMessageV1> }) },
    conversationSemanticStatus(projectId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/semantic-index`, { signal, decode: decodeResult<ConversationSemanticIndexStatusV1> }) },
    buildConversationSemanticIndex(projectId, input = {}, signal) { return request(`/projects/${encodeURIComponent(projectId)}/conversations/semantic-index`, { signal, timeoutMs: 120_000, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, decode: decodeResult<ConversationSemanticIndexStatusV1> }) },
    presentationList(projectId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/presentations`, { signal, decode: decodeResult<readonly PresentationViewV0[]> }) },
    presentationGet(projectId, presentationId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`, { signal, decode: decodeResult<PresentationViewV0> }) },
    presentationSave(projectId, presentationId, contract, expectedVersion, signal, origin) { return request(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`, { signal, init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract, expectedVersion, origin: origin ?? nextMutationOrigin(contract.capability) }) }, decode: decodeResult<PresentationViewV0> }) },
    mutationReceipt(projectId, operationId, runtimeId, signal) { const query = runtimeId === undefined ? '' : `?runtimeId=${encodeURIComponent(runtimeId)}`; return request(`/projects/${encodeURIComponent(projectId)}/mutations/${encodeURIComponent(operationId)}${query}`, { signal, decode: decodeResult<MutationReceipt> }) },
    presentationDelete(projectId, presentationId, signal) { return request(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`, { signal, init: { method: 'DELETE' }, decode: decodeResult<null> }) },
    async streamPresentation(projectId, presentationId, afterVersion, handlers, signal) {
      const query = afterVersion === undefined ? '' : `?afterVersion=${afterVersion}`
      const response = await fetch(
        `${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}/stream${query}`,
        { signal },
      )
      if (!response.ok || response.body === null) {
        throw new Error(`Local Core presentation SSE unavailable (HTTP ${response.status}).`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      const dispatch = (event: string, data: string): void => {
        if (!data) return
        try {
          const parsed: unknown = JSON.parse(data)
          const value = (parsed as { value?: unknown } | null)?.value
          if (value === undefined || typeof value !== 'object') return
          if (event === 'snapshot' || event === 'update') {
            handlers.onChange?.(value as { presentationId: string; version: number; updatedAt: string; updatedBy: string })
          }
        } catch {
          // Malformed frames are skipped; heartbeat keeps the stream alive.
        }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) data += `${line.slice(5).trim()}\n`
          }
          if (data) dispatch(eventName, data.trim())
          eventName = 'message'
        }
      }
    },
    async streamProjectPresentations(projectId, handlers, signal) {
      const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/presentations/stream`, { signal })
      if (!response.ok || response.body === null) throw new Error(`Local Core project presentation SSE unavailable (HTTP ${response.status}).`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      const dispatch = (event: string, data: string): void => {
        if (!data) return
        try {
          const value = (JSON.parse(data) as { value?: unknown } | null)?.value
          const changes = event === 'snapshot' && Array.isArray(value) ? value : [value]
          for (const change of changes) {
            if (change !== null && typeof change === 'object') handlers.onChange?.(change as { presentationId: string; version: number; updatedAt: string; updatedBy: string })
          }
        } catch { /* malformed frames are ignored; reconnect performs a snapshot */ }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) data += `${line.slice(5).trim()}\n`
          }
          if (data) dispatch(eventName, data.trim())
          eventName = 'message'
        }
      }
    },
    async streamProjectEvents(projectId, cursor, handlers, signal) {
      const query = new URLSearchParams()
      if (cursor.runtimeId !== undefined) query.set('runtimeId', cursor.runtimeId)
      if (cursor.lastSeenProjectSeq !== undefined) query.set('lastSeenProjectSeq', String(cursor.lastSeenProjectSeq))
      const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/events${query.size > 0 ? `?${query}` : ''}`, { signal })
      if (!response.ok || response.body === null) throw new Error(`Local Core project event stream unavailable (HTTP ${response.status}).`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      const dispatch = (event: string, data: string): void => {
        if (!data) return
        try {
          const value = (JSON.parse(data) as { value?: unknown } | null)?.value
          if (event === 'snapshot') handlers.onSnapshot?.(value as ProjectEventSnapshotV1)
          else if (event === 'replay') handlers.onReplay?.(value as ProjectEventReconnectV1 & { kind: 'replay' })
          else if (event === 'project-event') handlers.onEvent?.(value as ProjectEventEnvelope)
        } catch { /* one malformed frame does not tear down the transport */ }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) data += `${line.slice(5).trim()}\n`
          }
          if (data) dispatch(eventName, data.trim())
          eventName = 'message'
        }
      }
    },
    createProject(input, signal) {
      return request('/projects', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ProjectCatalogEntry>,
      })
    },
    selectObsidianVault(signal) {
      return request('/connectors/obsidian/select-and-scan', {
        signal,
        timeoutMs: 5 * 60_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
        decode: decodeResult<ObsidianVaultScanV1 | null>,
      })
    },
    importObsidianNotes(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connectors/obsidian/import`, {
        signal,
        timeoutMs: 60_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<readonly ImportResourceResultV1[]>,
      })
    },
    importResourceUrl(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/import-url`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ImportResourceResultV1>,
      })
    },
    resourceList(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources`, {
        signal,
        decode: decodeResult<readonly {
          readonly resourceId: string
          readonly artifactId: string
          readonly title: string
          readonly sourceKind?: string
          readonly status: string
          readonly analyzerVersion: string
        }[]>,
      })
    },
    resourceDescriptor(projectId, resourceId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/descriptor`, {
        signal,
        decode: decodeResult<ResourceDescriptorV0>,
      })
    },
    resourceReanalyze(projectId, resourceId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/reanalyze`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ResourceDescriptorV0>,
      })
    },
    resourceRead(projectId, resourceId, input, signal) {
      const query = new URLSearchParams()
      if (input.path !== undefined) query.set('path', input.path)
      if (input.limit !== undefined) query.set('limit', String(input.limit))
      const suffix = query.size === 0 ? '' : `?${query.toString()}`
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/content${suffix}`, {
        signal,
        decode: decodeResult<{
          readonly resourceId: string
          readonly fileName: string
          readonly mimeType?: string
          readonly contentHash?: string
          readonly size: number
          readonly offset: number
          readonly limit: number
          readonly truncated: boolean
          readonly format: string
          readonly data: string
        }>,
      })
    },
    listSpatialMarkers(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/spatial-markers`, {
        signal,
        decode: decodeResult<readonly SpatialMarkerIntentV0[]>,
      })
    },
    createSpatialMarker(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/spatial-markers`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<SpatialMarkerIntentV0>,
      })
    },
    deleteSpatialMarker(projectId, markerId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/spatial-markers/${encodeURIComponent(markerId)}`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'DELETE' },
        decode: decodeResult<{ readonly deleted: true; readonly markerId: string }>,
      })
    },
    resolveNavigationTarget(projectId, targetRef, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/navigation/resolve`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetRef }) },
        decode: decodeResult<NavigationResolutionV0>,
      })
    },
    async importResourceDirectory(projectId, input, signal) {
      const started = await request<{ sessionId: string }>(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ importRequestId: input.importRequestId, rootName: input.rootName, scopeId: input.scopeId, x: input.x, y: input.y, ...(input.note === undefined ? {} : { note: input.note }) }),
        },
        decode: decodeResult<{ sessionId: string }>,
      })
      if (!started.result.ok) return { ...started, result: started.result }
      const sessionId = started.result.value.sessionId
      for (const entry of input.files) {
        const uploaded = await request<null>(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(sessionId)}/files?path=${encodeURIComponent(entry.path)}`, {
          signal, timeoutMs: 30_000, init: { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: entry.file }, decode: decodeResult<null>,
        })
        if (!uploaded.result.ok) return { ...uploaded, result: uploaded.result }
      }
      return request(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(sessionId)}/complete`, {
        signal, timeoutMs: 30_000, init: { method: 'POST' }, decode: decodeResult<ImportResourceResultV1>,
      })
    },
    importResourceArchive(projectId, input, signal) {
      const body = new FormData()
      body.set('file', input.file)
      body.set('importRequestId', input.importRequestId)
      body.set('scopeId', input.scopeId)
      body.set('position.x', String(input.x))
      body.set('position.y', String(input.y))
      if (input.note !== undefined) body.set('note', input.note)
      return request(`/projects/${encodeURIComponent(projectId)}/resources/import-archive`, {
        signal,
        timeoutMs: 30_000,
        init: { method: 'POST', body },
        decode: decodeResult<ImportResourceResultV1>,
      })
    },
    metadataStatus(signal) {
      return request('/metadata/status', { signal, decode: decodeResult<MetadataStoreStatus> })
    },
    projectGraph(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/graph`, {
        signal,
        decode: decodeResult<ProjectGraphSnapshot>,
      })
    },
    deleteProject(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}`, {
        signal,
        init: { method: 'DELETE' },
        decode: decodeResult<{ deleted: boolean; projectId: string; note?: string }>,
      })
    },
    mergeWorkbench(projectId, workbenchScopeId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/workbench/merge`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workbenchScopeId }),
        },
        decode: decodeResult<{ mergedViews: number; restoredRefs: number; removedViews: number }>,
      })
    },
    createTextArtifact(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/text-artifacts`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<{
          readonly artifactId: string
          readonly revisionId: string
          readonly viewId: string
          readonly fileRecordId: string
          readonly title: string
        }>,
      })
    },
    readFileRecordText(projectId, fileRecordId, signal) {
      // 端点返回原始文件字节而非 JSON envelope，走 requestText 而不是 request()。
      return requestText(`/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(fileRecordId)}/content`, signal)
    },
    exportLcosproj(projectId, targetPath, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/export-lcosproj`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetPath }),
        },
        decode: decodeResult<unknown>,
      })
    },
    downloadLcosproj(projectId, signal) {
      return requestBlob(`/projects/${encodeURIComponent(projectId)}/export-lcosproj-file`, signal)
    },
    downloadHandoffZip(projectId, input = {}, signal) {
      const params = new URLSearchParams()
      if (input.targetArtifactId !== undefined) params.set('targetArtifactId', input.targetArtifactId)
      if (input.requestedOutput !== undefined) params.set('requestedOutput', input.requestedOutput)
      const query = params.toString()
      return requestBlob(`/projects/${encodeURIComponent(projectId)}/handoff-zip${query ? `?${query}` : ''}`, signal)
    },
    exportWorkflow(projectId, scopeId, signal) {
      return requestBlob(`/projects/${encodeURIComponent(projectId)}/workflow/export${scopeId ? `?scopeId=${encodeURIComponent(scopeId)}` : ''}`, signal)
    },
    importWorkflow(projectId, file, scopeId, signal) {
      const body = new FormData()
      body.set('file', file, file.name)
      return request(`/projects/${encodeURIComponent(projectId)}/workflow/import${scopeId ? `?scopeId=${encodeURIComponent(scopeId)}` : ''}`, {
        signal,
        timeoutMs: 120_000,
        init: { method: 'POST', body },
        decode: decodeResult<{ imported: boolean; members: number; workspaces: number }>,
      })
    },
    openLcosprojUpload(file, signal) {
      const body = new FormData()
      body.set('file', file, file.name)
      return request('/lcosproj/open-upload', {
        signal,
        timeoutMs: 120_000,
        init: { method: 'POST', body },
        decode: decodeResult<unknown>,
      })
    },
    exportAllLcosproj(targetDir, projectIds, signal) {
      return request('/lcosproj/export-all', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetDir, ...(projectIds === undefined ? {} : { projectIds }) }),
        },
        decode: decodeResult<unknown>,
      })
    },
    openLcosproj(filePath, rootPath, signal) {
      return request('/lcosproj/open', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ filePath, ...(rootPath === undefined ? {} : { rootPath }) }),
        },
        decode: decodeResult<unknown>,
      })
    },
    inspectLcosproj(filePath, signal) {
      return request(`/lcosproj/inspect?file=${encodeURIComponent(filePath)}`, {
        signal,
        decode: decodeResult<unknown>,
      })
    },
    workspaceMemberships(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/workspace-memberships`, {
        signal,
        decode: decodeResult<readonly WorkspaceMembership[]>,
      })
    },
    addWorkspaceMembers(workspaceId, input, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<readonly WorkspaceMembership[]>,
      })
    },
    removeWorkspaceMember(workspaceId, viewId, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(viewId)}`, {
        signal,
        init: { method: 'DELETE' },
        decode: decodeResult<readonly WorkspaceMembership[]>,
      })
    },
    moveWorkspaceMember(workspaceId, input, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/members/move`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<readonly WorkspaceMembership[]>,
      })
    },
    validateAgentPlan(projectId, plan, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs/validate-plan`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(plan),
        },
        decode: decodeResult<AgentExecutionPlanV1>,
      })
    },
    proposeRun(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs/propose`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RunProposalResult>,
      })
    },
    runtimeProviders(signal) {
      return request('/runtime/providers', {
        signal,
        decode: decodeResult<readonly RuntimeProviderStatus[]>,
      })
    },
    changeSets(projectId, limit = 50, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/change-sets?limit=${encodeURIComponent(String(limit))}`, {
        signal,
        decode: decodeResult<readonly MutationChangeSetV1[]>,
      })
    },
    changeSet(projectId, changeSetId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/change-sets/${encodeURIComponent(changeSetId)}`, {
        signal,
        decode: decodeResult<MutationChangeSetV1>,
      })
    },
    revertChangeSet(projectId, changeSetId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/change-sets/${encodeURIComponent(changeSetId)}/revert`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ origin: nextMutationOrigin('change-set') }),
        },
        decode: decodeResult<MutationChangeSetV1>,
      })
    },
    reapplyChangeSet(projectId, changeSetId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/change-sets/${encodeURIComponent(changeSetId)}/reapply`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ origin: nextMutationOrigin('change-set') }),
        },
        decode: decodeResult<MutationChangeSetV1>,
      })
    },
    prepareRevisionWorkflow(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/revision-workflows/prepare`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input, origin: nextMutationOrigin('feedback-revision') }),
        },
        decode: decodeResult<PreparedRevisionWorkflowV1>,
      })
    },
    relations(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/relations`, {
        signal,
        decode: decodeResult<readonly Relation[]>,
      })
    },
    saveRelation(projectId, relation, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/relations/${encodeURIComponent(String(relation.id))}`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ relation, origin: nextMutationOrigin('relation') }),
        },
        decode: decodeResult<Relation>,
      })
    },
    deleteRelation(projectId, relationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/relations/${encodeURIComponent(relationId)}`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ origin: nextMutationOrigin('relation') }),
        },
        decode: decodeResult<null>,
      })
    },
    createReorganizeProposal(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ReorganizeProposalV0>,
      })
    },
    previewReorganize(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals/${encodeURIComponent(proposalId)}/preview`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ReorganizePreviewV0>,
      })
    },
    applyReorganize(projectId, proposalId, confirmDestructive, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals/${encodeURIComponent(proposalId)}/apply`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirmDestructive }),
        },
        decode: decodeResult<ReorganizePreviewV0>,
      })
    },
    acceptReorganize(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals/${encodeURIComponent(proposalId)}/accept`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ReorganizeProposalV0>,
      })
    },
    rollbackReorganize(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals/${encodeURIComponent(proposalId)}/rollback`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ReorganizeProposalV0>,
      })
    },
    rejectReorganize(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/reorganize/proposals/${encodeURIComponent(proposalId)}/reject`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ReorganizeProposalV0>,
      })
    },
    createCheckpoint(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/checkpoints`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...input,
            projectId,
            createdAt: new Date().toISOString(),
          }),
        },
        decode: decodeResult<{
          readonly id: string
          readonly projectId: string
          readonly scopeId: string
          readonly label: string
          readonly createdAt: string
        }>,
      })
    },
    checkpoints(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/checkpoints`, {
        signal,
        decode: decodeResult<readonly Checkpoint[]>,
      })
    },
    previewRecords(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/preview-records`, {
        signal,
        decode: decodeResult<readonly PreviewRecord[]>,
      })
    },
    previewContent(projectId, previewRecordId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/preview-records/${encodeURIComponent(previewRecordId)}/content`, {
        signal,
        timeoutMs: 5_000,
        decode: decodeResult<PreviewContentResult>,
      })
    },
    generatePreview(projectId, revisionId, previewProfile, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/previews`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ revisionId, previewProfile }),
        },
        decode: decodeResult<GeneratePreviewResult>,
      })
    },
    updateActiveContext(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/active-context`, {
        signal,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...input, origin: nextMutationOrigin('active-context') }),
        },
        decode: decodeResult<ActiveContextProjection>,
      })
    },
    activeContext(projectId, workspaceId, afterVersion, signal) {
      const params = new URLSearchParams()
      if (workspaceId) params.set('workspaceId', workspaceId)
      if (afterVersion !== undefined) params.set('afterVersion', String(afterVersion))
      const query = params.toString() ? `?${params.toString()}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/active-context${query}`, {
        signal,
        decode: decodeResult<ActiveContextProjection>,
      })
    },
    async streamActiveContext(projectId, workspaceId, afterVersion, handlers, signal) {
      const params = new URLSearchParams()
      if (workspaceId) params.set('workspaceId', workspaceId)
      if (afterVersion !== undefined) params.set('afterVersion', String(afterVersion))
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(
        `${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/active-context/events${query}`,
        { signal },
      )
      if (!response.ok || response.body === null) {
        throw new Error(`Local Core SSE unavailable (HTTP ${response.status}).`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      const dispatch = (event: string, data: string): void => {
        if (!data) return
        try {
          const parsed: unknown = JSON.parse(data)
          const value = (parsed as { value?: unknown } | null)?.value
          if (value === undefined || typeof value !== 'object') return
          if (event === 'snapshot' || event === 'update') handlers.onContext?.(value as ActiveContextProjection)
          else if (event === 'proposals') handlers.onProposals?.(value as readonly ContextChangeProposalV1[])
          else if (event === 'runs') handlers.onRuns?.(value as readonly RunReview[])
        } catch {
          // Malformed frames are skipped; the next heartbeat/update keeps the stream alive.
        }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) data += (data === '' ? '' : '\n') + line.slice(5).trimStart()
          }
          if (['snapshot', 'update', 'proposals', 'runs'].includes(eventName)) dispatch(eventName, data)
        }
      }
    },
    getCommandDraft(projectId, workspaceId, composerAnchor, signal) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/command-drafts/${encodeURIComponent(composerAnchor)}${query}`, {
        signal,
        decode: decodeResult<CommandDraftV1 | null>,
      })
    },
    saveCommandDraft(projectId, workspaceId, composerAnchor, input, signal) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/command-drafts/${encodeURIComponent(composerAnchor)}${query}`, {
        signal,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, workspaceId }) },
        decode: decodeResult<CommandDraftV1>,
      })
    },
    deleteCommandDraft(projectId, workspaceId, composerAnchor, signal) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/command-drafts/${encodeURIComponent(composerAnchor)}${query}`, {
        signal,
        init: { method: 'DELETE' },
        decode: decodeResult<{ readonly deleted: boolean }>,
      })
    },
    getProviderSession(projectId, provider, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/provider-sessions/${provider}`, { signal, decode: decodeResult<ProviderSessionBindingV1 | null> })
    },
    saveProviderSession(projectId, provider, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/provider-sessions/${provider}`, {
        signal,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ProviderSessionBindingV1>,
      })
    },
    deleteProviderSession(projectId, provider, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/provider-sessions/${provider}`, { signal, init: { method: 'DELETE' }, decode: decodeResult<{ readonly deleted: boolean }> })
    },
    // RECEIVER-0 会话承接：纯 client 面，GUI 不接线
    listConnectedConversations(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations`, { signal, decode: decodeResult<readonly ConnectedConversationV1[]> })
    },
    connectConversation(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'connect', ...input }) },
        decode: decodeResult<ConnectedConversationV1>,
      })
    },
    createConnectedConversation(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', ...input }) },
        decode: decodeResult<ConnectedConversationV1>,
      })
    },
    disconnectConversation(projectId, connectedConversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations/${encodeURIComponent(connectedConversationId)}`, { signal, init: { method: 'DELETE' }, decode: decodeResult<{ readonly deleted: boolean }> })
    },
    getProjectReceiverBinding(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/receiver-binding`, { signal, decode: decodeResult<ProjectReceiverBindingV1> })
    },
    setActiveReceiver(projectId, connectedConversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/receiver-binding`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connectedConversationId }) },
        decode: decodeResult<ProjectReceiverBindingV1>,
      })
    },
    activeReceiverIdentity(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/active-receiver-identity`, { signal, decode: decodeResult<ActiveReceiverIdentityV1> })
    },
    connectedConversationIdentity(projectId, connectedConversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations/${encodeURIComponent(connectedConversationId)}/identity`, { signal, decode: decodeResult<ConversationIdentityChainV1> })
    },
    linkConnectedConversationSession(projectId, connectedConversationId, conversationSessionId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations/${encodeURIComponent(connectedConversationId)}/link-session`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversationSessionId }) },
        decode: decodeResult<ConversationIdentityChainV1>,
      })
    },
    artifactBirth(projectId, artifactId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactId)}/birth`, { signal, decode: decodeResult<ArtifactBirthProvenanceV1> })
    },
    sessionLifecycle(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/session-lifecycle`, { signal, decode: decodeResult<{ readonly states: readonly SessionLifecycleRecordProjectionV1[] }> })
    },
    recoverSessionLifecycle(projectId, provider, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/session-lifecycle/${encodeURIComponent(provider)}/recover`, { signal, init: { method: 'POST' }, decode: decodeResult<{ readonly state: SessionLifecycleRecordProjectionV1 }> })
    },
    prepareReceiverHandoff(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/receiver-handoff`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ProjectHandoffPackV1>,
      })
    },
    getPendingReceiverHandoff(projectId, conversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/receiver-handoff/${encodeURIComponent(conversationId)}`, {
        signal,
        decode: decodeResult<ProjectHandoffPackV1 | null>,
      })
    },
    consumeReceiverHandoff(projectId, conversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/receiver-handoff/${encodeURIComponent(conversationId)}/consume`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ProjectHandoffPackV1 | null>,
      })
    },
    proposeContextChange(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-proposals`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ContextChangeProposalV1>,
      })
    },
    acceptContextProposal(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-proposals/${encodeURIComponent(proposalId)}/accept`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<unknown>,
      })
    },
    rejectContextProposal(projectId, proposalId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-proposals/${encodeURIComponent(proposalId)}/reject`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<unknown>,
      })
    },
    listContextProposals(projectId, workspaceId, signal) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/context-proposals${query}`, {
        signal,
        decode: decodeResult<readonly ContextChangeProposalV1[]>,
      })
    },
    artifactSearch(projectId, query, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/artifacts/search?q=${encodeURIComponent(query)}`, {
        signal,
        decode: decodeResult<readonly {
          readonly id: string
          readonly title: string
          readonly kind: string
          readonly managed?: boolean
          readonly currentRevisionId?: string
        }[]>,
      })
    },
    projectSearch(projectId, query, input = {}, signal) {
      const params = new URLSearchParams({ q: query })
      if (input.limit !== undefined) params.set('limit', String(input.limit))
      if (input.types?.length) params.set('types', input.types.join(','))
      if (input.usedHereTarget) params.set('usedHereTarget', `${input.usedHereTarget.kind}:${input.usedHereTarget.id}`)
      return request(`/projects/${encodeURIComponent(projectId)}/search?${params.toString()}`, {
        signal,
        timeoutMs: 30_000,
        decode: decodeResult<SearchResultVNext>,
      })
    },
    warehouse(projectId, input = {}, signal) {
      const params = new URLSearchParams()
      if (input.search?.trim()) params.set('search', input.search.trim())
      if (input.kinds?.length) params.set('kinds', input.kinds.join(','))
      if (input.provenanceOrigin) params.set('provenance', input.provenanceOrigin)
      if (input.usedHereTarget) params.set('usedHereTarget', `${input.usedHereTarget.kind}:${input.usedHereTarget.id}`)
      if (input.limit !== undefined) params.set('limit', String(input.limit))
      if (input.cursor) params.set('cursor', input.cursor)
      const query = params.toString()
      return request(`/projects/${encodeURIComponent(projectId)}/warehouse${query ? `?${query}` : ''}`, {
        signal,
        decode: decodeResult<WarehouseSnapshotV1>,
      })
    },
    applyAssembly(projectId, input, signal) {
      const body: AssemblyApplyRequestV1 = { ...input, projectId }
      return request(`/projects/${encodeURIComponent(projectId)}/assembly/apply`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
        decode: decodeResult<AssemblyApplyResultV1>,
      })
    },
    projectSummary(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/summary`, { signal, decode: decodeResult<ProjectSummaryV1> })
    },
    projectVisualProfile(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/visual-profile`, { signal, decode: decodeResult<ProjectVisualProfileV0 | undefined> })
    },
    saveProjectVisualProfile(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/visual-profile`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ProjectVisualProfileV0>,
      })
    },
    projectSkills(projectId, search, signal) {
      const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/skills${query}`, { signal, decode: decodeResult<readonly SkillCatalogEntryV1[]> })
    },
    projectSkill(projectId, skillId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillId)}`, { signal, decode: decodeResult<SkillCatalogReadV1> })
    },
    conversationReach(projectId, connectedConversationId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/connected-conversations/${encodeURIComponent(connectedConversationId)}/reach`, { signal, decode: decodeResult<ConversationReachResultV0> })
    },
    createResultSlot(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/result-slots`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ResultSlotV0>,
      })
    },
    resultSlots(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/result-slots`, { signal, decode: decodeResult<readonly ResultSlotV0[]> })
    },
    resultSlot(resultSlotId, signal) {
      return request(`/result-slots/${encodeURIComponent(resultSlotId)}`, { signal, decode: decodeResult<ResultSlotV0> })
    },
    deleteResultSlot(resultSlotId, signal) {
      return request(`/result-slots/${encodeURIComponent(resultSlotId)}`, { signal, init: { method: 'DELETE' }, decode: decodeResult<null> })
    },
    runRecipe(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/recipe`, { signal, decode: decodeResult<RunRecipeV0> })
    },
    artifactDetail(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}`, {
        signal,
        decode: decodeResult<unknown>,
      })
    },
    revisionList(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/revisions`, {
        signal,
        decode: decodeResult<readonly unknown[]>,
      })
    },
    revisionCompare(projectId, baseRevisionId, headRevisionId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/revisions/compare?base=${encodeURIComponent(baseRevisionId)}&head=${encodeURIComponent(headRevisionId)}`, {
        signal,
        decode: decodeResult<unknown>,
      })
    },
    openArtifactSource(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/open`, { init: { method: 'POST' }, signal, decode: decodeResult<{ opened: boolean; path: string }> })
    },
    revealArtifactSource(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/reveal`, { init: { method: 'POST' }, signal, decode: decodeResult<{ revealed: boolean; path: string }> })
    },
    artifactSourcePath(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/source-path`, { signal, decode: decodeResult<{ path: string; exists: boolean; isUrl: boolean }> })
    },
    relinkArtifactSource(artifactId, path, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/relink`, { init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) }, signal, decode: decodeResult<{ relinked: boolean; path: string }> })
    },
    resolveArtifactShortcut(artifactId, signal) {
      return request(`/artifacts/${encodeURIComponent(artifactId)}/shortcut-resolve`, { init: { method: 'POST' }, signal, decode: decodeResult<{ shortcutPath: string; resolvedTarget: string | null; targetKind: string; targetExists: boolean }> })
    },
    processProjection(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/process-projection`, {
        signal,
        decode: decodeResult<readonly ProcessProjectionV1Item[]>,
      })
    },
    saveWorkspaceState(workspaceId, name, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/states`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        },
        decode: decodeResult<unknown>,
      })
    },
    listWorkspaceStates(workspaceId, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/states`, {
        signal,
        decode: decodeResult<readonly unknown[]>,
      })
    },
    restoreWorkspaceState(workspaceId, stateId, signal) {
      return request(`/workspaces/${encodeURIComponent(workspaceId)}/states/${encodeURIComponent(stateId)}/restore`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<unknown>,
      })
    },
    createSessionSummary(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/session-summaries`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<unknown>,
      })
    },
    listSessionSummaries(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/session-summaries`, {
        signal,
        decode: decodeResult<readonly unknown[]>,
      })
    },
    importCopy(projectId, input, signal) {
      const body = new FormData()
      body.set('file', input.file)
      body.set('importRequestId', input.importRequestId)
      body.set('scopeId', input.scopeId)
      body.set('position.x', String(input.x))
      body.set('position.y', String(input.y))
      body.set('sourceKind', 'import_copy')
      return request(`/projects/${encodeURIComponent(projectId)}/imports`, {
        signal,
        timeoutMs: 30_000,
        init: {
          method: 'POST',
          body,
        },
        decode: decodeResult<ImportCopyResult>,
      })
    },
    recordImportBatch(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/import-batches`, {
        signal,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) },
        decode: decodeResult<ImportBatchRefV1>,
      })
    },
    latestImportBatch(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/import-batches/latest`, {
        signal,
        decode: decodeResult<ImportBatchRefV1 | null>,
      })
    },
    getImportBatch(projectId, batchId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/import-batches/${encodeURIComponent(batchId)}`, {
        signal,
        decode: decodeResult<ImportBatchRefV1>,
      })
    },
    buildContextManifest(projectId, input = {}, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-manifests/v0`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ContextManifestV0>,
      })
    },
    createRuntimeRun(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs`, {
        signal,
        timeoutMs: 15_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    projectRunReviews(projectId, limit = 20, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs?limit=${encodeURIComponent(String(limit))}`, {
        signal,
        decode: decodeResult<readonly RunReview[]>,
      })
    },
    runEvents(runId, afterSequence, signal) {
      const query = afterSequence === undefined ? '' : `?after=${encodeURIComponent(String(afterSequence))}`
      return request(`/runs/${encodeURIComponent(runId)}/events${query}`, {
        signal,
        decode: decodeResult<readonly RunEvent[]>,
      })
    },
    dispatchRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/dispatch`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    recoverRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/recover`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    cancelRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/cancel`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    getRunInputRequest(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/input-request`, {
        signal,
        decode: decodeResult<RunInputRequestV1>,
      })
    },
    answerRunInput(runId, input, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/input-request`, {
        signal,
        timeoutMs: 15_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    syncRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/sync`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    finalizeRuntimeRun(runId, decision, comment, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/finalize`, {
        signal,
        timeoutMs: 15_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision, ...(comment === undefined ? {} : { comment }) }),
        },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    getRunReview(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/review`, {
        signal,
        decode: decodeResult<RunReview>,
      })
    },
    acceptArtifactReturn(returnId, input, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/accept`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<AcceptArtifactReturnResult>,
      })
    },
    rejectArtifactReturn(returnId, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/reject`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<RejectArtifactReturnResult>,
      })
    },
    retryArtifactReturn(returnId, input = {}, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/retry`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RetryRunResult>,
      })
    },
    refreshFileRecord(fileRecordId, signal) {
      return request(`/file-records/${encodeURIComponent(fileRecordId)}/refresh`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<FileObservationResult>,
      })
    },
    adoptExternalChange(fileRecordId, signal) {
      return request(`/file-records/${encodeURIComponent(fileRecordId)}/adopt`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<AdoptExternalChangeResult>,
      })
    },
    saveProjectGraph(snapshot, signal) {
      return request(`/projects/${encodeURIComponent(snapshot.project.id)}/graph`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot }),
        },
        decode: decodeResult<ProjectGraphSnapshot>,
      })
    },
    applyMutations(batch, projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/graph`, {
        signal,
        timeoutMs: LOCAL_CORE_WRITE_TIMEOUT_MS,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        },
        decode: decodeResult<MutationResult>,
      })
    },
    listContextSnapshots(projectId, workspaceId, signal) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      return request(`/projects/${encodeURIComponent(projectId)}/context-snapshots${query}`, {
        signal,
        decode: decodeResult<readonly Checkpoint[]>,
      })
    },
    createContextSnapshot(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-snapshots`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<Checkpoint>,
      })
    },
    compareContextSnapshots(projectId, snapshotId, otherSnapshotId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-snapshots/${encodeURIComponent(snapshotId)}/compare`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ otherSnapshotId }),
        },
        decode: decodeResult<SnapshotCompareResultV1>,
      })
    },
    branchContextSnapshot(projectId, snapshotId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-snapshots/${encodeURIComponent(snapshotId)}/branch`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<BranchSnapshotResultV1>,
      })
    },
    listHandoffs(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/handoffs`, {
        signal,
        decode: decodeResult<readonly HandoffRecord[]>,
      })
    },
    createHandoff(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/handoffs`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<HandoffRecord>,
      })
    },
    deleteHandoff(projectId, handoffId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/handoffs/${encodeURIComponent(handoffId)}`, {
        signal,
        init: { method: 'DELETE' },
        decode: decodeResult<{ readonly deleted: boolean }>,
      })
    },
  }
}

export async function loadStructuredTestReport(signal?: AbortSignal): Promise<Result<StructuredTestReport>> {
  try {
    const response = await fetch('/dev-test-report.json', {
      signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        ok: false,
        error: runtimeError(
          'NOT_FOUND',
          'No generated test report. Run npm run test:report.',
          true,
        ),
      }
    }
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null) {
      return {
        ok: false,
        error: runtimeError('UNAVAILABLE', 'Test report JSON has an unexpected shape.', false),
      }
    }
    return { ok: true, value: value as StructuredTestReport }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      ok: false,
      error: runtimeError(
        aborted ? 'ABORTED' : 'UNAVAILABLE',
        aborted ? 'Test report request was aborted.' : 'Test report is unavailable.',
        !aborted,
      ),
    }
  }
}
