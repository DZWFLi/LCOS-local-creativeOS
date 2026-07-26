import type {
  Artifact,
  ArtifactId,
  ArtifactReturn,
  ArtifactReturnId,
  ArtifactRevision,
  ArtifactRevisionId,
  ArtifactView,
  ArtifactViewId,
  FileRecord,
  FileRecordId,
  Checkpoint,
  CheckpointId,
  Command,
  CommandId,
  ContextSnapshot,
  ContextSnapshotId,
  GraphVersion,
  Note,
  Project,
  ProjectId,
  PreviewResult,
  PreviewKind,
  Run,
  RunEvent,
  RunId,
  Relation,
  RelationId,
  Scope,
  Workspace,
  WorkspaceId,
  WorkspaceContextPolicy,
  WorkspaceViewport,
} from '../../domain/src/index.js'

// Re-add types that were removed from domain (keep contracts boundary stable)
export interface WorkspaceQuery {
  readonly projectId: ProjectId
  readonly workspaceId?: WorkspaceId
}
export interface WorkspaceViewportCommand {
  readonly workspaceId: WorkspaceId
  readonly viewport: WorkspaceViewport
}

// ==================== Core types ====================

export type ContractOrigin = 'fixture' | 'runtime'

export interface ContractError {
  readonly code:
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'STALE_GRAPH_VERSION'
    | 'INPUT_REQUIRED'
    | 'UNAVAILABLE'
    | 'STALE'
    | 'CANCELLED'
    | 'FIXTURE_ONLY'
    | 'VALIDATION'
    | 'INVALID_ARGUMENT'
    | 'PROJECT_ROOT_NOT_FOUND'
    | 'PROJECT_ROOT_NOT_DIRECTORY'
    | 'PROJECT_ROOT_NOT_READABLE'
    | 'PATH_OUTSIDE_ALLOWED_ROOT'
    | 'ABORTED'
    | 'INTERNAL'
  readonly message: string
  readonly retryable: boolean
  readonly origin: ContractOrigin
}

export type Result<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ContractError }

export type ContractResult<Value> = Result<Value>

// ==================== Health & Metadata ====================

export interface HealthStatus {
  readonly status: 'ok'
  readonly service: 'local-core'
  readonly mode: 'read_only_phase_1a' | 'phase_2_lite' | 'phase_2_5'
  readonly version: string
}

// ==================== Project Graph Snapshot ====================

export interface ProjectGraphSnapshot {
  readonly schemaVersion: number
  readonly graphVersion: GraphVersion
  readonly project: Project
  readonly scopes: readonly Scope[]
  readonly workspaces: readonly Workspace[]
  readonly artifacts: readonly Artifact[]
  readonly artifactViews: readonly ArtifactView[]
  readonly relations: readonly Relation[]
  readonly notes: readonly Note[]
  readonly artifactRevisions: readonly ArtifactRevision[]
  readonly fileRecords: readonly FileRecord[]
  readonly checkpoints: readonly Checkpoint[]
}

// ==================== Mutation ====================

export type MutationOperation =
  | { readonly type: 'bootstrap'; readonly snapshot: ProjectGraphSnapshot }
  | { readonly type: 'move_artifact_view'; readonly viewId: ArtifactViewId; readonly x: number; readonly y: number }
  | { readonly type: 'resize_artifact_view'; readonly viewId: ArtifactViewId; readonly width: number; readonly height: number }
  | { readonly type: 'update_workspace_viewport'; readonly workspaceId: WorkspaceId; readonly viewport: WorkspaceViewport }
  | {
      readonly type: 'update_workspace_presentation'
      readonly workspaceId: WorkspaceId
      readonly focusedViewIds: readonly ArtifactViewId[]
      readonly visibleLayers: Workspace['visibleLayers']
    }
  | {
      readonly type: 'update_artifact_view_presentation'
      readonly viewId: ArtifactViewId
      readonly collapsed: ArtifactView['collapsed']
      readonly displayMode: ArtifactView['displayMode']
    }
  | { readonly type: 'upsert_workspace'; readonly workspace: Workspace }
  | { readonly type: 'delete_workspace'; readonly workspaceId: WorkspaceId }
  | { readonly type: 'upsert_scope'; readonly scope: Scope }
  | { readonly type: 'upsert_artifact'; readonly artifact: Artifact }
  | { readonly type: 'upsert_artifact_view'; readonly view: ArtifactView }
  | { readonly type: 'delete_artifact_view'; readonly viewId: ArtifactViewId }
  | { readonly type: 'upsert_relation'; readonly relation: Relation }
  | { readonly type: 'delete_relation'; readonly relationId: RelationId }
  | { readonly type: 'upsert_note'; readonly note: Note }

export interface MutationBatch {
  readonly baseVersion: GraphVersion
  readonly ops: readonly MutationOperation[]
}

export interface MutationResult {
  readonly graphVersion: GraphVersion
  readonly appliedOps: number
}

// ==================== Trusted source registration ====================

export type TrustedFileSelectionId = string & { readonly __brand: 'TrustedFileSelectionId' }

export interface TrustedFileSelection {
  readonly id: TrustedFileSelectionId
  readonly displayName: string
}

export interface RegisterTrustedSourceInput {
  readonly selectionId: TrustedFileSelectionId
  readonly title?: string
}

export interface RegisterTrustedSourceResult {
  readonly fileRecord: FileRecord
  readonly artifact: Artifact
  readonly revision: ArtifactRevision
}

export interface FileRecordRepository {
  get(fileRecordId: FileRecordId): Promise<Result<FileRecord>>
}

// ==================== Legacy Save (deprecated, kept for bootstrap/import) ====================

export interface SaveProjectGraphInput {
  readonly snapshot: ProjectGraphSnapshot
}

// ==================== Metadata ====================

export interface MetadataStoreStatus {
  readonly schemaVersion: number
  readonly databasePath: string
  readonly metadataOnly: true
}

export interface ValidateProjectRootInput {
  readonly rootPath: string
}

export interface ValidatedProjectRoot {
  readonly normalizedPath: string
  readonly exists: true
  readonly isDirectory: true
  readonly readable: true
}

// ==================== Catalog ====================

export interface ProjectCatalogEntry {
  readonly id: string
  readonly name: string
  readonly rootPath: string
  readonly graphVersion: GraphVersion
}

export interface AbortSignal {
  readonly aborted: boolean
}

// ==================== Contracts ====================

export interface ProjectCatalog {
  list(signal?: AbortSignal): Promise<Result<readonly ProjectCatalogEntry[]>>
}

export interface WorkspaceQueryContract {
  getWorkspaces(query: WorkspaceQuery): Promise<Result<readonly Workspace[]>>
  updateViewport(command: WorkspaceViewportCommand): Promise<Result<Workspace>>
}

export interface PreviewContract {
  getPreview(artifactId: ArtifactId, kind: PreviewKind, pageIndex?: number): Promise<Result<PreviewResult>>
}

export interface ProjectContract {
  getProject(projectId: ProjectId): Promise<ContractResult<Project>>
  getWorkspace(workspaceId: WorkspaceId): Promise<ContractResult<Workspace>>
  saveWorkspace(workspace: Workspace): Promise<ContractResult<Workspace>>
  createCheckpoint(checkpoint: Checkpoint): Promise<ContractResult<Checkpoint>>
  getCheckpoint(checkpointId: CheckpointId): Promise<ContractResult<Checkpoint>>
}

export interface ArtifactContract {
  getArtifact(artifactId: ArtifactId): Promise<ContractResult<Artifact>>
  getArtifactView(viewId: ArtifactViewId): Promise<ContractResult<ArtifactView>>
  createView(view: ArtifactView): Promise<ContractResult<ArtifactView>>
  getRevision(revisionId: ArtifactRevisionId): Promise<ContractResult<ArtifactRevision>>
  acceptReturn(returnId: ArtifactReturnId): Promise<ContractResult<ArtifactRevision>>
  rejectReturn(returnId: ArtifactReturnId): Promise<ContractResult<void>>
}

export interface ContextContract {
  createSnapshot(command: Command): Promise<ContractResult<ContextSnapshot>>
  getSnapshot(snapshotId: ContextSnapshotId): Promise<ContractResult<ContextSnapshot>>
}

export interface ExecutionRuntimeContract {
  createRun(commandId: CommandId, contextSnapshotId: ContextSnapshotId): Promise<ContractResult<Run>>
  getRun(runId: RunId): Promise<ContractResult<Run>>
  continueRun(runId: RunId, input: string): Promise<ContractResult<Run>>
  cancelRun(runId: RunId): Promise<ContractResult<Run>>
  retryRun(runId: RunId): Promise<ContractResult<Run>>
  getEvents(runId: RunId, afterSequence?: number): Promise<ContractResult<readonly RunEvent[]>>
  getReturns(runId: RunId): Promise<ContractResult<readonly ArtifactReturn[]>>
}

// Re-exports
export type {
  Artifact,
  ArtifactRevision,
  ArtifactView,
  Checkpoint,
  FileRecord,
  GraphVersion,
  Note,
  Project,
  Relation,
  Scope,
  Workspace,
  WorkspaceContextPolicy,
}
