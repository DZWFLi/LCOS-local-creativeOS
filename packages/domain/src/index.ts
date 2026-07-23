/**
 * Frontend Alpha domain vocabulary.
 *
 * These are pure, transport- and persistence-agnostic types. They deliberately
 * do not describe REST, SQLite, filesystem access, or Bridge implementation.
 */

export type Brand<Value, Name extends string> = Value & { readonly __brand: Name }

export type ProjectId = Brand<string, 'ProjectId'>
export type WorkspaceId = Brand<string, 'WorkspaceId'>
export type ArtifactId = Brand<string, 'ArtifactId'>
export type ArtifactViewId = Brand<string, 'ArtifactViewId'>
export type ArtifactRevisionId = Brand<string, 'ArtifactRevisionId'>
export type NoteId = Brand<string, 'NoteId'>
export type ContextSnapshotId = Brand<string, 'ContextSnapshotId'>
export type CommandId = Brand<string, 'CommandId'>
export type ConversationId = Brand<string, 'ConversationId'>
export type RunId = Brand<string, 'RunId'>
export type RunEventId = Brand<string, 'RunEventId'>
export type ArtifactReturnId = Brand<string, 'ArtifactReturnId'>
export type CheckpointId = Brand<string, 'CheckpointId'>
export type ContentHash = Brand<string, 'ContentHash'>

export type IsoDateTime = string

export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue }

export interface Project {
  readonly id: ProjectId
  readonly name: string
  readonly rootPath: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type WorkspaceIntent = 'understand' | 'explore' | 'build' | 'decide' | null

export interface WorkspaceViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export interface Workspace {
  readonly id: WorkspaceId
  readonly projectId: ProjectId
  readonly name: string
  readonly intent: WorkspaceIntent
  readonly viewport: WorkspaceViewport
  readonly focusedNodeIds: readonly string[]
  readonly visibleLayers: readonly string[]
  readonly layoutPreset?: string
  readonly contextPolicy?: JsonValue
  readonly selectionState?: JsonValue
  readonly updatedAt: IsoDateTime
}

export interface WorkspaceQuery {
  readonly projectId: ProjectId
  readonly workspaceId?: WorkspaceId
  readonly includeViewport?: boolean
}

export interface WorkspaceViewportCommand {
  readonly workspaceId: WorkspaceId
  readonly viewport: WorkspaceViewport
}

export type ArtifactKind = 'markdown' | 'image' | 'presentation' | 'pdf' | 'other'
export type ArtifactAvailability = 'available' | 'missing' | 'stale'

export interface Artifact {
  readonly id: ArtifactId
  readonly projectId: ProjectId
  readonly title: string
  readonly kind: ArtifactKind
  readonly localPath: string
  readonly availability: ArtifactAvailability
  readonly currentRevisionId?: ArtifactRevisionId
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type ArtifactViewReferenceKind = 'primary' | 'explicit_additional'

export interface ArtifactView {
  readonly id: ArtifactViewId
  readonly artifactId: ArtifactId
  readonly workspaceId: WorkspaceId
  readonly revisionId?: ArtifactRevisionId
  readonly referenceKind: ArtifactViewReferenceKind
  readonly position: { readonly x: number; readonly y: number }
  readonly size: { readonly width: number; readonly height: number }
  readonly displayMode: 'card' | 'thumbnail' | 'compact'
  readonly collapsed: boolean
}

export type ArtifactRevisionSource = 'import' | 'run' | 'external'
export type ArtifactRevisionStatus = 'draft' | 'current' | 'superseded'

export interface ArtifactRevision {
  readonly id: ArtifactRevisionId
  readonly artifactId: ArtifactId
  readonly parentRevisionId?: ArtifactRevisionId
  readonly localPath: string
  readonly contentHash: ContentHash
  readonly source: ArtifactRevisionSource
  readonly runId?: RunId
  readonly status: ArtifactRevisionStatus
  readonly createdAt: IsoDateTime
}

export type PreviewState = 'idle' | 'loading' | 'ready' | 'error'
export type PreviewKind = 'thumbnail' | 'page' | 'original'

export interface PreviewResult {
  readonly artifactId: ArtifactId
  readonly state: PreviewState
  readonly kind: PreviewKind
  readonly origin: 'fixture' | 'runtime'
  readonly contentUrl?: string
  readonly pageIndex?: number
  readonly pageCount?: number
  readonly errorMessage?: string
}

export type NoteAnchor =
  | { readonly scope: 'artifact'; readonly artifactId: ArtifactId }
  | { readonly scope: 'artifact_view'; readonly artifactId: ArtifactId; readonly artifactViewId: ArtifactViewId }
  | { readonly scope: 'page'; readonly artifactId: ArtifactId; readonly pageIndex: number }

export interface Note {
  readonly id: NoteId
  readonly projectId: ProjectId
  readonly anchor: NoteAnchor
  readonly body: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export interface ContextSourceRef {
  readonly artifactId?: ArtifactId
  readonly revisionId?: ArtifactRevisionId
  readonly noteId?: NoteId
  readonly label: string
}

export interface ContextSnapshot {
  readonly id: ContextSnapshotId
  readonly projectId: ProjectId
  readonly commandId: CommandId
  readonly sourceRefs: readonly ContextSourceRef[]
  readonly contentHash: ContentHash
  readonly createdAt: IsoDateTime
}

export type CommandOutputMode = 'modify_in_place' | 'new_revision' | 'new_artifact' | 'note'

export interface Command {
  readonly id: CommandId
  readonly projectId: ProjectId
  readonly workspaceId: WorkspaceId
  readonly instruction: string
  readonly selectedObjectIds: readonly string[]
  readonly targetArtifactId?: ArtifactId
  readonly workingArtifactId?: ArtifactId
  readonly contextSnapshotId?: ContextSnapshotId
  readonly outputMode: CommandOutputMode
  readonly createdAt: IsoDateTime
}

export interface Conversation {
  readonly id: ConversationId
  readonly projectId: ProjectId
  readonly createdAt: IsoDateTime
}

export type RunStatus = 'queued' | 'running' | 'waiting_input' | 'review' | 'completed' | 'failed' | 'cancelled'
export type RunExecutor = 'codex'

export interface Run {
  readonly id: RunId
  readonly projectId: ProjectId
  readonly conversationId: ConversationId
  readonly commandId: CommandId
  /** Immutable for this run. A changed context requires a new run. */
  readonly contextSnapshotId: ContextSnapshotId
  readonly executor: RunExecutor
  readonly externalThreadId?: string
  readonly status: RunStatus
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type RunEventType =
  | 'run.queued'
  | 'run.started'
  | 'run.waiting_input'
  | 'run.review_ready'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancel_requested'
  | 'run.cancelled'
  | 'run.retry_queued'

export interface RunEvent {
  readonly id: RunEventId
  readonly runId: RunId
  readonly sequence: number
  readonly type: RunEventType
  readonly occurredAt: IsoDateTime
  readonly payload: JsonValue
}

export interface ChangedFile {
  readonly runId: RunId
  readonly action: 'created' | 'modified' | 'deleted' | 'moved'
  readonly projectRelativePath: string
  readonly beforeHash?: ContentHash
  readonly afterHash?: ContentHash
}

export type ArtifactReturnDisposition = 'pending_return' | 'new_revision' | 'new_artifact' | 'conflict'

export interface ArtifactReturn {
  readonly id: ArtifactReturnId
  readonly runId: RunId
  readonly artifactId?: ArtifactId
  readonly targetArtifactId?: ArtifactId
  readonly targetRevisionId?: ArtifactRevisionId
  readonly localPath: string
  readonly contentHash: ContentHash
  readonly title: string
  readonly disposition: ArtifactReturnDisposition
  readonly createdAt: IsoDateTime
}

export interface Checkpoint {
  readonly id: CheckpointId
  readonly projectId: ProjectId
  readonly workspaceId: WorkspaceId
  readonly contextSnapshotId?: ContextSnapshotId
  readonly artifactRevisionIds: readonly ArtifactRevisionId[]
  readonly relatedRunIds: readonly RunId[]
  readonly canvasSnapshot: JsonValue
  readonly createdAt: IsoDateTime
}

export type ArtifactReturnPlacement =
  | { readonly zone: 'target'; readonly artifactId: ArtifactId }
  | { readonly zone: 'working'; readonly artifactId: ArtifactId }
  | { readonly zone: 'run'; readonly runId: RunId }
  | { readonly zone: 'pending_return'; readonly workspaceId: WorkspaceId }

/** Target and Context are intentionally independent. */
export function resolveArtifactReturnPlacement(command: Command, run?: Run): ArtifactReturnPlacement {
  if (command.targetArtifactId) return { zone: 'target', artifactId: command.targetArtifactId }
  if (command.workingArtifactId) return { zone: 'working', artifactId: command.workingArtifactId }
  if (run) return { zone: 'run', runId: run.id }
  return { zone: 'pending_return', workspaceId: command.workspaceId }
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
