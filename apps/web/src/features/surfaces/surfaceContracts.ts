import type { ExecutionItemAction } from '@local-creative-os/contracts'
import type { ActiveRun, CanvasNode } from '../../model'

export type SurfaceAttentionBucket = 'pinned' | 'related' | 'retrieved'

/**
 * B4 Attention marks are a read-only Presentation projection. Selection stays
 * in the existing spatial session; these ids only explain why the runtime is
 * also looking at other Project Entities on the current Surface.
 */
export interface SurfaceAttentionMarks {
  readonly pinnedIds: readonly string[]
  readonly relatedIds: readonly string[]
  readonly retrievedIds: readonly string[]
}

export function surfaceAttentionBucket(marks: SurfaceAttentionMarks | undefined, id: string): SurfaceAttentionBucket | undefined {
  if (marks?.pinnedIds.includes(id)) return 'pinned'
  if (marks?.relatedIds.includes(id)) return 'related'
  if (marks?.retrievedIds.includes(id)) return 'retrieved'
  return undefined
}

export interface ContextHistoryEntry {
  id: string
  label: string
  title: string
  summary?: string
  current?: boolean
  sourceRunId?: string
  sourceNodeId?: string
  objectIds: string[]
  createdAt?: string
}

export interface SessionHandoffProjection {
  id: string
  from: string
  to: string
  label?: string
  /** 紧凑次行：决定 / 未决 / 产物数 + 日期；不暴露 provider runtime 细节。 */
  meta?: string
  sourceNodeId?: string
  targetNodeId?: string
}

export interface ContextSurfaceRuntime {
  history: ContextHistoryEntry[]
  handoffs: SessionHandoffProjection[]
  onBranchHistory: (entry: ContextHistoryEntry) => void
  onCompareHistory: (entry: ContextHistoryEntry) => void
  onOpenHistorySource: (entry: ContextHistoryEntry) => void
}

export interface WorkSurfaceRuntime {
  activeRun: ActiveRun | null
  /** Canonical runtime controls. Missing action means unavailable: fail-close. */
  runActions: readonly ExecutionItemAction[]
  runEvents: ReadonlyArray<{ id: string | number; type: string; occurredAt: string | number | Date }>
  pendingReviewCount: number
  onCancel: () => void
  onRetry: () => void
  onReview: () => void
  onOpenRunDetails: (node: CanvasNode) => void
  onAnswerInput: (input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => void
}

export interface DeliverSurfaceRuntime {
  activeRun: ActiveRun | null
  /** Canonical runtime controls. Review actions remain owned by review truth. */
  runActions: readonly ExecutionItemAction[]
  pendingReviewCount: number
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
  onReview: () => void
  onOpenRevisions: (node: CanvasNode) => void
  onCompareNodes: (left: CanvasNode, right: CanvasNode) => void
}
