/**
 * PresentationViewV0 contract — frozen at Phase A (Contract Freeze & Detox).
 *
 * Presentation is a re-buildable view over Project Truth. It owns membership,
 * position, hierarchy, display relations, manual anchors, emphasis and
 * renderer choice — NOT business semantics, revisions, runs or file truth.
 *
 * Deliberately excluded from this contract: business ontology fields and
 * browser ephemeral state (those belong to ActiveContext or the browser).
 *
 * No database migration in Phase A; this file only locks the interface.
 */

export type PresentationCapabilityV0 =
  | 'arrange'
  | 'context'
  | 'workflow'
  | 'custom'

export type PresentationEmphasisV0 =
  | 'primary'
  | 'normal'
  | 'secondary'
  | 'muted'

export interface PresentationEdgeV0 {
  id: string
  fromViewId: string
  toViewId: string
  label?: string
}

export interface PresentationHierarchyV0 {
  parentByViewId: Record<string, string | null>
  orderByParent: Record<string, string[]>
}

export interface PresentationStateV0 {
  memberViewIds: string[]
  hiddenViewIds: string[]
  positions: Record<string, { x: number; y: number }>
  hierarchy: PresentationHierarchyV0
  presentationEdges: PresentationEdgeV0[]
  pinnedViewIds: string[]
  emphasisByViewId: Record<string, PresentationEmphasisV0>
}

export interface PresentationViewV0 {
  schemaVersion: 0
  id: string
  projectId: string
  scopeId: string
  capability: PresentationCapabilityV0
  renderer: string
  state: PresentationStateV0
  version: number
  updatedBy: 'web' | 'agent' | 'core'
  createdAt: string
  updatedAt: string
}
