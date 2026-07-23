import type {
  Artifact,
  ArtifactId,
  ArtifactReturn,
  ArtifactReturnId,
  ArtifactRevision,
  ArtifactRevisionId,
  ArtifactView,
  ArtifactViewId,
  Checkpoint,
  CheckpointId,
  Command,
  CommandId,
  ContextSnapshot,
  ContextSnapshotId,
  Project,
  ProjectId,
  PreviewResult,
  PreviewKind,
  WorkspaceQuery,
  WorkspaceViewportCommand,
  Run,
  RunEvent,
  RunId,
  Relation,
  Workspace,
  WorkspaceId,
} from '../../domain/src/index.js'

/** Pure application boundaries for Frontend Interaction Foundation. */
export type ContractOrigin = 'fixture' | 'runtime'

export interface ContractError {
  readonly code:
    | 'NOT_FOUND'
    | 'CONFLICT'
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

/** Backwards-compatible name for existing adapter drafts. */
export type ContractResult<Value> = Result<Value>

export interface HealthStatus {
  readonly status: 'ok'
  readonly service: 'local-core'
  readonly mode: 'read_only_phase_1a' | 'phase_2_lite'
  readonly version: string
}

export interface ProjectGraphSnapshot {
  readonly schemaVersion: number
  readonly project: Project
  readonly workspaces: readonly Workspace[]
  readonly artifacts: readonly Artifact[]
  readonly artifactViews: readonly ArtifactView[]
  readonly relations: readonly Relation[]
}

export interface SaveProjectGraphInput {
  readonly disposable: true
  readonly snapshot: ProjectGraphSnapshot
}

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

export interface ProjectCatalogEntry {
  readonly id: string
  readonly name: string
  readonly rootPath: string
}

/** Structural subset accepted from the platform AbortSignal without a DOM dependency. */
export interface AbortSignal {
  readonly aborted: boolean
}

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

export type {
  Artifact,
  ArtifactView,
  Project,
  Relation,
  Workspace,
}
