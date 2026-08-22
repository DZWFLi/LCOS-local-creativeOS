/**
 * PresentationViewV0 contract — frozen at Phase A (Contract Freeze & Detox).
 *
 * Presentation is a re-buildable view over Project Truth. It owns membership,
 * position, hierarchy, display relations, manual anchors, emphasis and
 * renderer choice — NOT business semantics, revisions, runs or file truth.
 *
 * R3.1-A semantic correction: `scopeId` identifies/persists the Presentation
 * owner; it is NOT a membership boundary. `memberViewIds` may reference any
 * ArtifactView in the same Project, regardless of the View's physical Scope.
 * Main Canvas / Context Graph / Workflow are parallel projections over Project Truth.
 * A concrete Context is another Presentation over those same Project Views; its
 * Signal Track and Mind Map are renderers of one exact member set.
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

export type PresentationLayoutModeV0 = 'freeform' | 'grid'

export interface PresentationGridLayoutV0 {
  /** Stable semantic-neutral order for Grid mode. */
  order: string[]
  columns?: number
  gap?: number
}

export type PresentationEmphasisV0 =
  | 'primary'
  | 'normal'
  | 'secondary'
  | 'muted'

export type PresentationEntityTypeV0 = 'view' | 'scope' | 'workspace'

export interface PresentationEntityRefV0 {
  type: PresentationEntityTypeV0
  id: string
}

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

/**
 * Phase 3 §6.3：Signal Track 段（Presentation-only，不落任何 Core 业务实体）。
 * 轴表达理解/顺序，不是时间；成员必须是 Presentation 成员视图。
 */
export interface ContextTrackSegmentV0 {
  id: string
  memberViewIds: string[]
  order: number
  collapsed: boolean
  label?: string
}

/**
 * Phase 4 §7.1-7.3：Workflow operator（authoring metadata，Presentation-only）。
 * Core 不执行语义条件；predicateText 只是创作内容，由 Skill/Agent 在运行时解释。
 */
export type WorkflowOperatorKindV0 = 'condition' | 'parallel-split' | 'parallel-join' | 'reference'

export interface WorkflowConditionBranchV0 {
  id: string
  label: string
  predicateText?: string
  targetViewId?: string
}

export interface WorkflowOperatorV0 {
  kind: WorkflowOperatorKindV0
  label?: string
  branches?: WorkflowConditionBranchV0[]
}


export interface WorkflowActionV0 {
  id: string
  label: string
  description?: string
  /** Existing Project Views used by this action. No Artifact clone is created. */
  attachedViewIds: string[]
  x: number
  y: number
}

export interface WorkflowActionEdgeV0 {
  id: string
  fromActionId: string
  toActionId: string
  label?: string
}

export interface PresentationSpatialRegionV0 {
  id: string
  label?: string
  /** Presentation-space bounds. Membership is derived live from geometry. */
  bounds: { x: number; y: number; width: number; height: number }
}

/**
 * Spatial Surface component contract. Components are Presentation-only
 * projections over Project Truth. Bindings keep identity/locators only; they
 * never embed a copied Project entity.
 */
export type SurfaceKindV0 = 'main' | 'context' | 'workflow'

export type SurfaceComponentTypeV0 =
  | 'fence'
  | 'region'
  | 'portal'
  | 'structure-map'
  | 'evolution'
  | 'relationship-field'
  | 'context-pack'
  | 'workflow-step'
  | 'review'
  | 'checkpoint'
  | 'workbench'

export interface SurfaceBoundsV0 {
  x: number
  y: number
  w: number
  h: number
}

export interface SurfaceBindingV0 {
  entityId?: string
  artifactId?: string
  workflowId?: string
  stepId?: string
  contextId?: string
  projectViewId?: string
  /** Stable Project View identity refs used as component seeds. No copied entity payloads. */
  projectViewIds?: string[]
  checkpointId?: string
  runId?: string
}

export interface SurfaceElementPresentationV0 {
  pinned?: boolean
  collapsed?: boolean
  zIndex?: number
  variant?: string
}

export interface SurfaceElementV0 {
  id: string
  projectId: string
  surface: SurfaceKindV0
  type: SurfaceComponentTypeV0
  bounds: SurfaceBoundsV0
  binding?: SurfaceBindingV0
  presentation?: SurfaceElementPresentationV0
}

export interface PresentationStateV0 {
  memberViewIds: string[]
  /** Aggregate Project entities that do not require fake ArtifactViews (e.g. Workspace). */
  memberEntityRefs?: PresentationEntityRefV0[]
  hiddenViewIds: string[]
  /** Freeform positions are preserved even while Grid is active. */
  positions: Record<string, { x: number; y: number }>
  layoutMode?: PresentationLayoutModeV0
  /** Grid never owns membership; it only stores order/slot presentation state. */
  gridLayout?: PresentationGridLayoutV0
  hierarchy: PresentationHierarchyV0
  presentationEdges: PresentationEdgeV0[]
  pinnedViewIds: string[]
  emphasisByViewId: Record<string, PresentationEmphasisV0>
  /** Main-canvas fences are durable Presentation geometry, never frozen member snapshots. */
  spatialRegions?: PresentationSpatialRegionV0[]
  /** Trusted spatial components. They store Presentation geometry + identity-only binding. */
  surfaceElements?: SurfaceElementV0[]
  trackSegments?: ContextTrackSegmentV0[]
  workflowOperators?: Record<string, WorkflowOperatorV0>
  /** Workflow-only action skeleton. Materials remain memberViewIds and are attached by reference. */
  workflowActions?: WorkflowActionV0[]
  workflowActionEdges?: WorkflowActionEdgeV0[]
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
