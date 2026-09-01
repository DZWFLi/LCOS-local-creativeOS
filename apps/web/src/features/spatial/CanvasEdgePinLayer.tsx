import type { Camera } from '../../model'
import { SpatialMarkerLayer } from './SpatialMarkerLayer'
import type { SpatialMarkerAttention, SpatialMarkerScope, SpatialMarkerSurfaceKind } from './spatialMarkerSystem'
import type { SpatialInsets } from './spatialTypes'

/**
 * Compatibility input for existing pinned-attention callers. The item is now a
 * Spatial Marker candidate, not an "edge pin" entity: viewport projection decides
 * whether it renders as a world pin, edge cursor or density cluster.
 */
export interface CanvasEdgePinItem {
  readonly id: string
  readonly label: string
  readonly bounds: Readonly<{ x: number; y: number; width: number; height: number }>
  readonly surface?: SpatialMarkerSurfaceKind
  readonly scope?: SpatialMarkerScope
  readonly sourceSurfaceRef?: string
  readonly targetSurfaceRef?: string
  readonly groupKey?: string
  readonly groupLabel?: string
  readonly attention?: SpatialMarkerAttention
  readonly priority?: number
}

interface Props {
  readonly camera: Camera
  readonly viewportSize: Readonly<{ width: number; height: number }>
  readonly safeInsets?: SpatialInsets | undefined
  readonly items: readonly CanvasEdgePinItem[]
  readonly currentSurfaceRef?: string
  readonly defaultSurface?: SpatialMarkerSurfaceKind
  readonly onLocate: (id: string) => void
  readonly onLocateCluster?: (ids: readonly string[]) => void
}

/**
 * Legacy component name retained only as an API adapter during F6A2 migration.
 * Rendering ownership belongs to SpatialMarkerLayer. There is no second edge
 * navigation system anymore.
 */
export function CanvasEdgePinLayer({ camera, viewportSize, safeInsets, items, currentSurfaceRef, defaultSurface = 'main', onLocate, onLocateCluster }: Props) {
  if (!items.length) return null
  return <div className="lcos-edge-pin-layer" data-testid="spatial-edge-pin-layer">
    <SpatialMarkerLayer
      camera={camera}
      viewportSize={viewportSize}
      safeInsets={safeInsets}
      currentSurfaceRef={currentSurfaceRef}
      onLocate={onLocate}
      onLocateCluster={onLocateCluster}
      items={items.map((item) => ({
        id: item.id,
        label: item.label,
        bounds: item.bounds,
        surface: item.surface ?? defaultSurface,
        scope: item.scope ?? 'local',
        sourceSurfaceRef: item.sourceSurfaceRef ?? currentSurfaceRef,
        targetSurfaceRef: item.targetSurfaceRef,
        groupKey: item.groupKey,
        groupLabel: item.groupLabel,
        attention: item.attention,
        priority: item.priority,
      }))}
    />
  </div>
}
