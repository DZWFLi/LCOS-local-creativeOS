import type { Camera } from '../../model'
import type {
  NavigationResolutionV0,
  NavigationSurfaceKindV0,
  SpatialMarkerIntentV0,
  SpatialMarkerScopeV0,
  SpatialMarkerTargetRefV0,
} from '@local-creative-os/contracts'
import { SPATIAL_LABEL_PRIORITY } from './SpatialLabelSystem'
import { EDGE_PIN_EDGE_INSET, edgePinEdgeForPlacement, edgePinForWorldBounds, type EdgePinEdge } from './edgePinGeometry'
import type { SpatialBounds, SpatialSize } from './spatialTypes'

/**
 * Spatial Marker is the single navigation intent presented as a world pin,
 * offscreen edge cursor, or density cluster. Durable intent types come directly
 * from Core contracts; pin/cursor/cluster remain Presentation-only projections.
 */
export type SpatialMarkerScope = SpatialMarkerScopeV0
export type SpatialMarkerSurfaceKind = NavigationSurfaceKindV0
export type SpatialMarkerMorphology = 'main' | 'context' | 'workflow' | 'neutral'
export type SpatialMarkerAttention = 'normal' | 'selected' | 'focus' | 'search' | 'beacon'
export type SpatialMarkerProjectionKind = 'world-pin' | 'edge-cursor'

export interface SpatialNavigationTargetResolverV0 {
  readonly resolve: (targetRef: SpatialMarkerTargetRefV0) => Promise<NavigationResolutionV0>
}

/** No fuzzy title/provider/time rebinding. A missing target stays unresolved. */
export async function resolveSpatialMarkerNavigation(
  intent: SpatialMarkerIntentV0,
  currentProjectId: string,
  resolver: SpatialNavigationTargetResolverV0,
): Promise<NavigationResolutionV0> {
  if (intent.projectId !== currentProjectId || intent.targetRef.projectId !== currentProjectId) {
    return { status: 'unresolved', reason: 'cross-project' }
  }
  return resolver.resolve(intent.targetRef)
}

export interface SpatialMarkerItem {
  readonly id: string
  readonly label: string
  readonly bounds: SpatialBounds
  readonly surface: SpatialMarkerSurfaceKind
  readonly scope: SpatialMarkerScope
  /** Local markers are visible only on their source surface. Cross-surface markers pierce surfaces. */
  readonly sourceSurfaceRef?: string
  readonly targetSurfaceRef?: string
  readonly attention?: SpatialMarkerAttention
  readonly priority?: number
  /** Semantic direction used only for fan-out grouping, never persisted as a new entity. */
  readonly groupKey?: string
  readonly groupLabel?: string
}

export interface ProjectedSpatialMarker {
  readonly item: SpatialMarkerItem
  readonly kind: SpatialMarkerProjectionKind
  readonly x: number
  readonly y: number
  readonly angleRad: number
  readonly edge?: EdgePinEdge
  readonly morphology: SpatialMarkerMorphology
  readonly priority: number
}

export interface SpatialMarkerCluster {
  readonly id: string
  readonly kind: 'cluster'
  readonly x: number
  readonly y: number
  readonly morphology: SpatialMarkerMorphology
  readonly surface: SpatialMarkerSurfaceKind
  readonly scope: SpatialMarkerScope
  readonly edge?: EdgePinEdge
  readonly members: readonly ProjectedSpatialMarker[]
  readonly priority: number
}

export type SpatialMarkerProjection =
  | { readonly kind: 'marker'; readonly marker: ProjectedSpatialMarker }
  | SpatialMarkerCluster

export interface SpatialMarkerFanGroup {
  readonly id: string
  readonly label: string
  readonly members: readonly ProjectedSpatialMarker[]
  readonly memberIds: readonly string[]
  readonly overflowCount: number
}

export function spatialMarkerMorphology(surface: SpatialMarkerSurfaceKind): SpatialMarkerMorphology {
  if (surface === 'main') return 'main'
  if (surface === 'context') return 'context'
  if (surface === 'workflow') return 'workflow'
  return 'neutral'
}

/** Shared SpatialCanvas surface identity → marker morphology. Exact surface IDs only. */
export function spatialMarkerSurfaceForCanvas(testId?: string): SpatialMarkerSurfaceKind {
  switch (testId) {
    case 'context-graph-spatial':
    case 'context-space-spatial':
    case 'context-flow-spatial':
    case 'context-tree-spatial':
      return 'context'
    case 'workflow-graph-spatial':
    case 'workflow-spatial':
      return 'workflow'
    case 'canvas':
    default:
      return 'main'
  }
}

export function spatialMarkerPriority(item: SpatialMarkerItem): number {
  if (item.priority !== undefined) return item.priority
  switch (item.attention) {
    case 'beacon': return SPATIAL_LABEL_PRIORITY.beacon
    case 'focus':
    case 'search': return SPATIAL_LABEL_PRIORITY.searchFocus
    case 'selected': return SPATIAL_LABEL_PRIORITY.selected
    default: return SPATIAL_LABEL_PRIORITY.document
  }
}

export function spatialMarkerVisibleOnSurface(item: SpatialMarkerItem, currentSurfaceRef?: string): boolean {
  if (item.scope === 'cross-surface') return true
  if (!item.sourceSurfaceRef || !currentSurfaceRef) return true
  return item.sourceSurfaceRef === currentSurfaceRef
}

export function projectSpatialMarker(
  item: SpatialMarkerItem,
  camera: Camera,
  viewportSize: SpatialSize,
): ProjectedSpatialMarker {
  const placement = edgePinForWorldBounds(item.bounds, camera, viewportSize, EDGE_PIN_EDGE_INSET)
  return {
    item,
    kind: placement.isOnscreen ? 'world-pin' : 'edge-cursor',
    x: placement.screenX,
    y: placement.screenY,
    angleRad: placement.angle,
    edge: placement.isOnscreen ? undefined : edgePinEdgeForPlacement(placement, viewportSize, EDGE_PIN_EDGE_INSET),
    morphology: spatialMarkerMorphology(item.surface),
    priority: spatialMarkerPriority(item),
  }
}

function markerClusterRadius(zoom: number): number {
  // Density follows screen scale, not an arbitrary "20 markers" threshold.
  return Math.max(44, Math.min(88, 52 + Math.max(0, 1 - zoom) * 44))
}

function distance(a: Pick<ProjectedSpatialMarker, 'x' | 'y'>, b: Pick<ProjectedSpatialMarker, 'x' | 'y'>): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function breakout(marker: ProjectedSpatialMarker): boolean {
  return marker.priority >= SPATIAL_LABEL_PRIORITY.selected
}

function clusterCompatibility(a: ProjectedSpatialMarker, b: ProjectedSpatialMarker): boolean {
  if (a.kind !== b.kind) return false
  if (a.item.surface !== b.item.surface) return false
  if (a.edge !== b.edge) return false
  return true
}

function clusterFromMembers(members: readonly ProjectedSpatialMarker[], serial: number): SpatialMarkerCluster {
  const x = members.reduce((sum, marker) => sum + marker.x, 0) / members.length
  const y = members.reduce((sum, marker) => sum + marker.y, 0) / members.length
  const first = members[0]!
  return {
    id: `marker-cluster:${first.kind}:${first.item.surface}:${first.edge ?? 'world'}:${serial}`,
    kind: 'cluster',
    x,
    y,
    morphology: first.morphology,
    surface: first.item.surface,
    scope: members.some((marker) => marker.item.scope === 'cross-surface') ? 'cross-surface' : 'local',
    edge: first.edge,
    members: [...members].sort((a, b) => b.priority - a.priority || a.item.label.localeCompare(b.item.label)),
    priority: Math.max(...members.map((marker) => marker.priority)),
  }
}

/**
 * Spatial declutter pass. Nearby markers on the same projection edge/surface
 * form a presentation cluster. Search/Focus/Beacon/Selection break out so a
 * target can never disappear inside a crowd.
 */
export function projectSpatialMarkers(input: {
  readonly items: readonly SpatialMarkerItem[]
  readonly camera: Camera
  readonly viewportSize: SpatialSize
  readonly currentSurfaceRef?: string
}): readonly SpatialMarkerProjection[] {
  const radius = markerClusterRadius(input.camera.zoom)
  const markers = input.items
    .filter((item) => spatialMarkerVisibleOnSurface(item, input.currentSurfaceRef))
    .map((item) => projectSpatialMarker(item, input.camera, input.viewportSize))
    .sort((a, b) => b.priority - a.priority || a.item.id.localeCompare(b.item.id))

  const projections: SpatialMarkerProjection[] = []
  const buckets: ProjectedSpatialMarker[][] = []

  for (const marker of markers) {
    if (breakout(marker)) {
      projections.push({ kind: 'marker', marker })
      continue
    }
    const bucket = buckets.find((candidate) => {
      const center = {
        x: candidate.reduce((sum, entry) => sum + entry.x, 0) / candidate.length,
        y: candidate.reduce((sum, entry) => sum + entry.y, 0) / candidate.length,
      }
      return clusterCompatibility(candidate[0]!, marker) && distance(center, marker) <= radius
    })
    if (bucket) bucket.push(marker)
    else buckets.push([marker])
  }

  buckets.forEach((members, index) => {
    if (members.length === 1) projections.push({ kind: 'marker', marker: members[0]! })
    else projections.push(clusterFromMembers(members, index))
  })

  return projections.sort((a, b) => {
    const ap = a.kind === 'cluster' ? a.priority : a.marker.priority
    const bp = b.kind === 'cluster' ? b.priority : b.marker.priority
    return bp - ap
  })
}

/**
 * First fan is semantic, not a flat menu. Each semantic group exposes at most
 * six direct children; overflow remains a count for zoom/focus rather than
 * exploding dozens of bubbles at once.
 */
export function spatialMarkerFanGroups(cluster: SpatialMarkerCluster, maxGroups = 5, leafCap = 6): readonly SpatialMarkerFanGroup[] {
  const grouped = new Map<string, { label: string; members: ProjectedSpatialMarker[] }>()
  for (const marker of cluster.members) {
    const key = marker.item.groupKey ?? 'other'
    const existing = grouped.get(key)
    if (existing) existing.members.push(marker)
    else grouped.set(key, { label: marker.item.groupLabel ?? (key === 'other' ? '其它' : key), members: [marker] })
  }

  const ordered = [...grouped.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label))

  if (ordered.length <= maxGroups) {
    return ordered.map((group) => ({
      id: `${cluster.id}:group:${group.key}`,
      label: group.label,
      members: group.members.slice(0, leafCap),
      memberIds: group.members.map((member) => member.item.id),
      overflowCount: Math.max(0, group.members.length - leafCap),
    }))
  }

  const visible = ordered.slice(0, Math.max(1, maxGroups - 1))
  const overflow = ordered.slice(visible.length).flatMap((group) => group.members)
  return [
    ...visible.map((group) => ({
      id: `${cluster.id}:group:${group.key}`,
      label: group.label,
      members: group.members.slice(0, leafCap),
      memberIds: group.members.map((member) => member.item.id),
      overflowCount: Math.max(0, group.members.length - leafCap),
    })),
    {
      id: `${cluster.id}:group:more`,
      label: '更多方向',
      members: overflow.slice(0, leafCap),
      memberIds: overflow.map((member) => member.item.id),
      overflowCount: Math.max(0, overflow.length - leafCap),
    },
  ]
}
