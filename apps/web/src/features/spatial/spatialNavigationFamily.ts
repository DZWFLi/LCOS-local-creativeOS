import type { SpatialMarkerIntentV0, SpatialMarkerTargetRefV0, StableSurfaceRefV0 } from '@local-creative-os/contracts'

export interface SpatialMarkerRecordLike {
  readonly intent: SpatialMarkerIntentV0
}

export function sameSpatialNavigationTarget(a: SpatialMarkerTargetRefV0, b: SpatialMarkerTargetRefV0): boolean {
  return a.projectId === b.projectId && a.kind === b.kind && a.id === b.id
}

export function markerForNavigationTarget(records: readonly SpatialMarkerRecordLike[], targetRef: SpatialMarkerTargetRefV0): SpatialMarkerIntentV0 | null {
  return records.find((record) => sameSpatialNavigationTarget(record.intent.targetRef, targetRef))?.intent ?? null
}

/** Rail entries only become durable landmarks when they already expose a canonical Surface identity. */
export function stableRailSurfaceRef(input: { readonly id: string; readonly workspaceId?: string; readonly scopeId?: string }): StableSurfaceRefV0 | null {
  if (input.workspaceId) return `workspace:${input.workspaceId}`
  if (input.scopeId && input.id === `scope:${input.scopeId}`) return `scope:${input.scopeId}`
  return null
}

export function agentProposalMarkerTargets(projectId: string, proposal: {
  readonly targetViewId?: string
  readonly addViewIds: readonly string[]
}): readonly SpatialMarkerTargetRefV0[] {
  const ids = [...new Set([...(proposal.targetViewId ? [proposal.targetViewId] : []), ...proposal.addViewIds].filter(Boolean))]
  return ids.map((id) => ({ projectId, kind: 'view' as const, id }))
}

export interface SemanticNavigationRegionInput {
  readonly id: string
  readonly label?: string
  readonly memberViewIds: readonly string[]
  readonly bounds: Readonly<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }>
}

export interface SemanticNavigationRegionOverview extends SemanticNavigationRegionInput {
  readonly markerId: string
}

/**
 * R2-C semantic-area overview is camera-driven Presentation only. The current
 * adapter consumes legacy Region/Fence geometry; R3-A may swap its truth source
 * to Colony without changing the navigation contract.
 */
export function semanticNavigationRegionOverviews(
  regions: readonly SemanticNavigationRegionInput[],
  zoom: number,
): readonly SemanticNavigationRegionOverview[] {
  if (zoom >= .55) return []
  return regions
    .filter((region) => region.memberViewIds.length >= 2 && region.bounds.width > 0 && region.bounds.height > 0)
    .map((region) => ({ ...region, markerId: `semantic-region:${region.id}` }))
}
