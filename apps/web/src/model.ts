export type NodeKind = 'source' | 'working' | 'generated' | 'context' | 'process' | 'decision' | 'note'
export type NodeLayer = 'core' | 'process'
export type NodeDisplayMode = 'compact' | 'standard' | 'expanded'
export type WorkspaceIntent = 'understand' | 'explore' | 'build' | 'decide' | null
export type RunStatus = 'queued' | 'running' | 'waiting_input' | 'review' | 'completed' | 'failed'
export type ArtifactReviewStatus = 'idle' | 'pending' | 'accepted'
export type ScopeKind = 'root' | 'collection' | 'context' | 'delivery'
export type PreviewAvailability = 'not-generated' | 'ready' | 'failed' | 'unsupported'
export type RuntimeImportState = 'temporary' | 'importing' | 'persisted' | 'failed'

export interface CanvasNode {
  id: string
  kind: NodeKind
  title: string
  subtitle: string
  x: number
  y: number
  width: number
  height: number
  displayMode?: NodeDisplayMode
  draft?: boolean
  current?: boolean
  pageCount?: number
  fileType?: string
  fileSize?: number
  previewUrl?: string
  artifactId?: string
  revisionId?: string
  revisionCount?: number
  revisionLabel?: string
  historical?: boolean
  managed?: boolean
  createdAt?: string
  sourceRunId?: string
  sourcePrompt?: string
  sourceProvider?: string
  contextCount?: number
  targetCount?: number
  outputCount?: number
  fileRecordId?: string
  fileAvailability?: 'current' | 'stale' | 'missing' | 'unreadable'
  contentHash?: string
  observedPath?: string
  followsCurrentRevision?: boolean
  previewStatus?: PreviewAvailability
  previewProfile?: string
  previewRenderer?: string
  previewError?: string
  previewMimeType?: string
  previewDataUrl?: string
  previewText?: string
  viewOf?: string
  error?: boolean
  disabled?: boolean
  workspaceIds?: string[]
  parentRunId?: string
  revisionOf?: string
  resultGroupId?: string
  scopeId?: string
  opensScopeId?: string
  editable?: boolean
  contextOnly?: boolean
  runStatus?: RunStatus
  commandText?: string
  positionLocked?: boolean
  runtimeState?: RuntimeImportState
  runtimeTransient?: boolean
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
  kind: 'reference' | 'generate' | 'modify' | 'feedback'
  active?: boolean
}

export interface Camera { x: number; y: number; zoom: number }

export interface CanvasScope {
  id: string
  label: string
  kind: ScopeKind
  parentScopeId: string | null
  containerNodeId?: string
  camera: Camera
  layoutMode?: 'manual' | 'semantic'
  updatedAt?: string
}

export interface Workspace {
  id: string
  label: string
  intent: WorkspaceIntent
  scopeId: string
  camera: Camera // legacy v0.6 viewport field; v0.6.1 navigation no longer reads or continuously writes it
  visibleLayers: NodeLayer[]
  focusedViewIds: string[]
  contextPolicy: 'workspace-related' | 'selection-only'
  createdAt: string
  updatedAt: string
}

export interface WorkRailPreferences {
  pinned: boolean
  collapsed: boolean
  width: number
  lastFocusNodeId?: string
}

export interface ActiveRun {
  id: string
  status: RunStatus
  command: string
  targetIds: string[]
  contextIds: string[]
  processNodeId: string
  commandId?: string
  contextSnapshotId?: string
  pendingArtifactId?: string
  reviewStatus: ArtifactReviewStatus
  inputResolved?: boolean
  changedFiles: string[]
  createdAt: string
  runtime?: boolean
  runtimeReturnId?: string
  baseRevisionId?: string
  providerError?: string
  provider?: string
  outputIntent?: 'analyze' | 'create' | 'revise'
  resultPolicy?: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
  proposalSummary?: string
}

export interface ProjectPackage {
  id: string
  label: string
  localPath: string
  updatedAt: string
  pendingCount: number
  rootScopeId?: string
}

export interface ProjectNavigationState {
  projectId: string
  camera: Camera
  updatedAt: string
}

export interface WorkspaceFrameVM {
  workspaceId: string
  label: string
  scopeId: string
  memberViewIds: string[]
  bounds: { x: number; y: number; width: number; height: number }
  active: boolean
}

export interface PersistedPrototypeState {
  version: number
  projectId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  workspaces: Workspace[]
  scopes: CanvasScope[]
  activeWorkspaceId: string | null
  activeScopeId: string
  workRail: WorkRailPreferences
}

export interface TargetContextInference {
  targetIds: string[]
  contextIds: string[]
  ambiguousTargetIds: string[]
  reason: string
}

export const nodeMeta: Record<NodeKind, { label: string; accent: string; shape: string; layer: NodeLayer }> = {
  source: { label: '内容', accent: '#6687B8', shape: '●', layer: 'core' },
  working: { label: '当前内容', accent: '#496FAE', shape: '◆', layer: 'core' },
  generated: { label: 'AI 结果', accent: '#7556C9', shape: '✦', layer: 'core' },
  context: { label: '内容集合', accent: '#4D9084', shape: '◇', layer: 'core' },
  process: { label: '执行记录', accent: '#6F7D89', shape: '→', layer: 'process' },
  decision: { label: '确认记录', accent: '#AA7B3E', shape: '✓', layer: 'process' },
  note: { label: '文本', accent: '#B45F54', shape: '✎', layer: 'process' },
}

export const runStatusLabel: Record<RunStatus, string> = {
  queued: '排队中',
  running: '执行中',
  waiting_input: '等待确认',
  review: '结果待确认',
  completed: '已完成',
  failed: '执行失败',
}

export const nodeDisplayModeLabel: Record<NodeDisplayMode, string> = {
  compact: '紧凑',
  standard: '标准',
  expanded: '展开',
}

export const workspaceIntentOptions: Array<{ value: WorkspaceIntent; label: string; description: string }> = [
  { value: null, label: '不设置', description: '只保存名称、位置和上下文范围' },
  { value: 'understand', label: '理解', description: '阅读资料、归纳问题与限制' },
  { value: 'explore', label: '探索', description: '发散方向、组织参考与比较可能性' },
  { value: 'build', label: '构建', description: '形成脚本、分镜、提案与交付物' },
  { value: 'decide', label: '决策', description: '评审、比较、确认、锁定与交付' },
]
