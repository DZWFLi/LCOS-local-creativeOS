import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Camera } from '../../model'
import { projectSpatialBeacon } from './spatialBeaconGeometry'
import type { SpatialBeaconState } from './useSpatialFocusRequest'

/**
 * Structural Beacon layer: offscreen direction → camera approach → world arrival.
 * Visual treatment stays deliberately quiet until the Native GUI review.
 */
export function SpatialBeaconLayer({ beacon, camera, onArrivalEnd }: { readonly beacon: SpatialBeaconState | null; readonly camera: Camera; readonly onArrivalEnd?: () => void }) {
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

  if (!beacon) return null
  const projected = projectSpatialBeacon(beacon.target, camera, viewport)
  return <div ref={layerRef} className="lcos-spatial-beacon-layer" aria-hidden="true" data-beacon-phase={beacon.phase} data-beacon-offscreen={projected.offscreen || undefined}>
    <i
      className={`lcos-spatial-beacon is-${beacon.phase}${projected.offscreen ? ' is-offscreen' : ''}`}
      style={{ left: projected.x, top: projected.y, '--lcos-beacon-angle': `${projected.angleRad}rad` } as CSSProperties}
      onAnimationEnd={() => { if (beacon.phase === 'arrival') onArrivalEnd?.() }}
    />
  </div>
}
