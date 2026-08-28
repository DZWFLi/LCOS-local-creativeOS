import { useLayoutEffect, useRef, useState } from 'react'
import type { Camera } from '../../model'
import { SpatialMarkerLayer } from './SpatialMarkerLayer'
import { SPATIAL_LABEL_PRIORITY } from './SpatialLabelSystem'
import type { SpatialMarkerScope, SpatialMarkerSurfaceKind } from './spatialMarkerSystem'
import type { SpatialBeaconState } from './useSpatialFocusRequest'

/**
 * Beacon is no longer a separate arrow system. It is a transient high-priority
 * Spatial Marker: onscreen it is a world pin; offscreen the same marker becomes
 * an edge cursor. Search/Focus can therefore share clustering and priority rules.
 */
export function SpatialBeaconLayer({
  beacon,
  camera,
  onArrivalEnd,
  surface = 'main',
  scope = 'local',
  sourceSurfaceRef,
}: {
  readonly beacon: SpatialBeaconState | null
  readonly camera: Camera
  readonly onArrivalEnd?: () => void
  readonly surface?: SpatialMarkerSurfaceKind
  readonly scope?: SpatialMarkerScope
  readonly sourceSurfaceRef?: string
}) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1000, height: 760 })

  useLayoutEffect(() => {
    const element = layerRef.current
    if (!element) return
    const update = () => {
      const next = { width: element.clientWidth || 1000, height: element.clientHeight || 760 }
      setViewport((current) => current.width === next.width && current.height === next.height ? current : next)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const markerItem = beacon ? {
    id: `beacon:${beacon.nonce}:${beacon.target.id}`,
    label: beacon.target.label ?? '目标',
    bounds: {
      x: beacon.target.x,
      y: beacon.target.y,
      width: beacon.target.width,
      height: beacon.target.height,
    },
    surface,
    scope,
    sourceSurfaceRef,
    attention: 'beacon' as const,
    priority: SPATIAL_LABEL_PRIORITY.beacon,
    groupKey: 'navigation',
    groupLabel: '导航',
  } : null

  return <div
    ref={layerRef}
    className="lcos-spatial-beacon-layer"
    aria-hidden="true"
    data-beacon-phase={beacon?.phase}
    data-beacon-kind={beacon?.target.visualKind ?? undefined}
  >
    {beacon && markerItem ? <SpatialMarkerLayer
      camera={camera}
      viewportSize={viewport}
      interactive={false}
      markerPhase={beacon.phase}
      onMarkerAnimationEnd={onArrivalEnd}
      items={[markerItem]}
    /> : null}
  </div>
}
