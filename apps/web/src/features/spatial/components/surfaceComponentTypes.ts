import type { SurfaceElement } from '../model/surfaceElementTypes'
import type { CanvasEdge, CanvasNode } from '../../../model'
import type { PresentationHierarchyState } from '../../presentation/presentationHierarchy'
import type { ContextHistoryEntry } from '../../surfaces/surfaceContracts'

export interface SurfaceComponentRenderContext {
  readonly nodes?: readonly CanvasNode[]
  readonly edges?: readonly CanvasEdge[]
  readonly hierarchy?: PresentationHierarchyState
  readonly history?: readonly ContextHistoryEntry[]
  readonly reviews?: readonly { readonly runId: string; readonly label: string; readonly phase: string }[]
  readonly checkpoints?: readonly { readonly checkpointId: string; readonly label: string; readonly createdAt: string }[]
  readonly onOpenReview?: (runId: string) => void
  readonly onOpenPortal?: (projectViewId: string) => void
  readonly onSelectNode?: (id: string, additive?: boolean) => void
  readonly onOpenNode?: (id: string) => void
  readonly onOpenHistorySource?: (entry: ContextHistoryEntry) => void
}

export interface SurfaceComponentRenderProps {
  readonly element: SurfaceElement
  readonly selected?: boolean
  readonly meta?: string
  readonly context?: SurfaceComponentRenderContext
}
