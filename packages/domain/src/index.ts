/**
 * Phase 2.5 Data Spine Cleanup — Domain Rewrite
 *
 * Key changes:
 * - Scope is now a formal domain entity (was implicit/absent)
 * - Relation references entities, not ArtifactViews
 * - Workspace has scopeId + contextPolicy (formalized)
 * - ArtifactView belongs to Scope, not Workspace
 * - Project has graphVersion for optimistic concurrency
 * - Checkpoint is immutable snapshot only (no junction tables)
 */

export type Brand<Value, Name extends string> = Value & { readonly __brand: Name }

export type ProjectId = Brand<string, 'ProjectId'>
export type WorkspaceId = Brand<string, 'WorkspaceId'>
export type ScopeId = Brand<string, 'ScopeId'>
export type ArtifactId = Brand<string, 'ArtifactId'>
export type ArtifactViewId = Brand<string, 'ArtifactViewId'>
export type RelationId = Brand<string, 'RelationId'>
export type ArtifactRevisionId = Brand<string, 'ArtifactRevisionId'>
export type FileRecordId = Brand<string, 'FileRecordId'>
export type NoteId = Brand<string, 'NoteId'>
export type ContextSnapshotId = Brand<string, 'ContextSnapshotId'>
export type CommandId = Brand<string, 'CommandId'>
export type ConversationId = Brand<string, 'ConversationId'>
export type RunId = Brand<string, 'RunId'>
export type RunEventId = Brand<string, 'RunEventId'>
export type ArtifactReturnId = Brand<string, 'ArtifactReturnId'>
export type CheckpointId = Brand<string, 'CheckpointId'>
export type PreviewRecordId = Brand<string, 'PreviewRecordId'>
export type ContentHash = Brand<string, 'ContentHash'>

export type IsoDateTime = string
export type GraphVersion = Brand<number, 'GraphVersion'>

export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue }

// ==================== Project ====================

export interface Project {
  readonly id: ProjectId
  readonly name: string
  readonly rootPath: string
  readonly graphVersion: GraphVersion
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== Scope ====================

export type ScopeKind = 'root' | 'collection' | 'context' | 'delivery'

export interface Scope {
  readonly id: ScopeId
  readonly projectId: ProjectId
  readonly parentScopeId: ScopeId | null
  readonly containerViewId: ArtifactViewId | null
  readonly kind: ScopeKind
  readonly name: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== Workspace ====================

export type WorkspaceIntent = 'understand' | 'explore' | 'build' | 'decide' | null

export interface WorkspaceViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export type WorkspaceContextPolicy = 'workspace-related' | 'selection-only'

export interface Workspace {
  readonly id: WorkspaceId
  readonly projectId: ProjectId
  readonly scopeId: ScopeId
  readonly name: string
  readonly intent: WorkspaceIntent
  readonly viewport: WorkspaceViewport
  readonly focusedViewIds: readonly ArtifactViewId[]
  readonly visibleLayers: readonly string[]
  readonly contextPolicy: WorkspaceContextPolicy
  readonly updatedAt: IsoDateTime
}

// ==================== Artifact ====================

export type ArtifactKind = 'markdown' | 'image' | 'presentation' | 'pdf' | 'other'
export type ArtifactAvailability = 'available' | 'missing' | 'stale'

export interface Artifact {
  readonly id: ArtifactId
  readonly projectId: ProjectId
  readonly title: string
  readonly kind: ArtifactKind
  readonly availability: ArtifactAvailability
  readonly currentRevisionId?: ArtifactRevisionId
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== ArtifactView ====================

// ArtifactView belongs to Scope, not Workspace.
// A single Artifact can have multiple Views across different Scopes.

export type ArtifactViewReferenceKind = 'primary' | 'explicit_additional'

export interface ArtifactView {
  readonly id: ArtifactViewId
  readonly artifactId: ArtifactId
  readonly scopeId: ScopeId
  readonly revisionId?: ArtifactRevisionId
  readonly referenceKind: ArtifactViewReferenceKind
  readonly position: { readonly x: number; readonly y: number }
  readonly size: { readonly width: number; readonly height: number }
  readonly displayMode: 'card' | 'thumbnail' | 'compact'
  readonly collapsed: boolean
}

// ==================== Relation ====================

// Relation connects Domain Entities, not Views.
// Deleting a view does NOT delete the business relationship.

export type RelationEntityType = 'artifact' | 'note' | 'scope'

export interface Relation {
  readonly id: RelationId
  readonly projectId: ProjectId
  readonly sourceEntityType: RelationEntityType
  readonly sourceEntityId: string
  readonly targetEntityType: RelationEntityType
  readonly targetEntityId: string
  readonly kind: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== ArtifactRevision ====================

export type ArtifactRevisionSource = 'import' | 'run' | 'external'
export type ArtifactRevisionStatus = 'draft' | 'current' | 'superseded'

export interface ArtifactRevision {
  readonly id: ArtifactRevisionId
  readonly artifactId: ArtifactId
  readonly fileRecordId: FileRecordId
  readonly parentRevisionId?: ArtifactRevisionId
  readonly contentHash: ContentHash
  readonly source: ArtifactRevisionSource
  readonly runId?: RunId
  readonly status: ArtifactRevisionStatus
  readonly createdAt: IsoDateTime
}

// ==================== FileRecord ====================

export type FileAvailability = 'current' | 'stale' | 'missing' | 'unreadable'

export interface FileRecord {
  readonly id: FileRecordId
  readonly projectId: ProjectId
  readonly observedPath: string
  readonly observedHash: ContentHash
  readonly size: number
  readonly modifiedAt: IsoDateTime
  readonly mimeType: string
  readonly availability: FileAvailability
  readonly observedAt: IsoDateTime
}

// ==================== Note ====================

export type NoteAnchor =
  | { readonly type: 'project' }
  | { readonly type: 'scope'; readonly scopeId: ScopeId }
  | { readonly type: 'artifact'; readonly artifactId: ArtifactId }
  | { readonly type: 'artifact_view'; readonly viewId: ArtifactViewId }
  | { readonly type: 'page'; readonly revisionId: ArtifactRevisionId; readonly pageIndex: number }

export interface Note {
  readonly id: NoteId
  readonly projectId: ProjectId
  readonly anchor: NoteAnchor
  readonly body: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== Checkpoint ====================

// Checkpoint is an immutable historical snapshot.
// It does NOT participate in autosave — the camera lives in Workspace.viewport.

export interface Checkpoint {
  readonly id: CheckpointId
  readonly projectId: ProjectId
  readonly scopeId: ScopeId
  readonly label: string
  readonly snapshotJson: JsonValue
  readonly createdAt: IsoDateTime
}

// ==================== Preview (unchanged) ====================

export type PreviewState = 'idle' | 'loading' | 'ready' | 'error'
export type PreviewKind = 'thumbnail' | 'page' | 'original'
export type PreviewRecordStatus = 'ready' | 'failed' | 'unsupported'

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

export interface PreviewRecord {
  readonly id: PreviewRecordId
  readonly projectId: ProjectId
  readonly revisionId: ArtifactRevisionId
  readonly sourceContentHash: ContentHash
  readonly rendererId: string
  readonly rendererVersion: string
  readonly previewProfile: string
  readonly cacheKey: string
  readonly cachePath: string
  readonly mimeType: string
  readonly size: number
  readonly status: PreviewRecordStatus
  readonly errorMessage?: string
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

// ==================== Run (preserved, Phase 5) ====================

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

export type ArtifactReturnPlacement =
  | { readonly zone: 'target'; readonly artifactId: ArtifactId }
  | { readonly zone: 'working'; readonly artifactId: ArtifactId }
  | { readonly zone: 'run'; readonly runId: RunId }
  | { readonly zone: 'pending_return'; readonly workspaceId: WorkspaceId }

export function resolveArtifactReturnPlacement(command: Command, run?: Run): ArtifactReturnPlacement {
  if (command.targetArtifactId) return { zone: 'target', artifactId: command.targetArtifactId }
  if (command.workingArtifactId) return { zone: 'working', artifactId: command.workingArtifactId }
  if (run) return { zone: 'run', runId: run.id }
  return { zone: 'pending_return', workspaceId: command.workspaceId }
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
