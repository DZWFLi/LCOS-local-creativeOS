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
  readonly message: string
  readonly retryable: boolean
  readonly origin: ContractOrigin
}

export type Result<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ContractError }

/** Backwards-compatible name for existing adapter drafts. */
export type ContractResult<Value> = Result<Value>

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
