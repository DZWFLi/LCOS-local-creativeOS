import type { ActiveRun, CanvasNode } from '../../model'

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
  pendingReviewCount: number
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
  onReview: () => void
  onOpenRevisions: (node: CanvasNode) => void
  onCompareNodes: (left: CanvasNode, right: CanvasNode) => void
}
