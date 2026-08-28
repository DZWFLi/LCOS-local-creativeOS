import { useCallback, useEffect, useRef, useState } from 'react'
import type { Camera } from '../../model'
import { fitSpatialBounds, spatialBoundsForPlacements } from './spatialCamera'
import type { MiniMapVisualKind } from './minimapSemantics'

export interface SpatialFocusRequest {
  readonly nonce: number
  readonly ids: readonly string[]
  /** Destination guard: a remounted Surface must never consume another Surface's request. */
  readonly targetTestId?: string
}

export interface SpatialFocusItem {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly label?: string
  readonly visualKind?: MiniMapVisualKind
}

export interface SpatialBeaconState {
  readonly nonce: number
  readonly phase: 'approach' | 'arrival'
  readonly target: SpatialFocusItem
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3) }

/** Focus is read-only spatial navigation: Beacon → camera approach → arrival. Never Selection/Membership. */
export function useSpatialFocusRequest(input: {
  readonly request?: SpatialFocusRequest
  readonly items: readonly SpatialFocusItem[]
  readonly testId: string
  readonly camera?: Camera
  readonly setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  readonly padding?: number
}): { readonly beacon: SpatialBeaconState | null; readonly clearBeacon: () => void } {
  const handledNonce = useRef<number>(-1)
  const raf = useRef<number | null>(null)
  const cameraRef = useRef<Camera | undefined>(input.camera)
  const itemsRef = useRef(input.items)
  const setCameraRef = useRef(input.setCamera)
  const paddingRef = useRef(input.padding)
  cameraRef.current = input.camera
  itemsRef.current = input.items
  setCameraRef.current = input.setCamera
  paddingRef.current = input.padding
  const [beacon, setBeacon] = useState<SpatialBeaconState | null>(null)
  const clearBeacon = useCallback(() => setBeacon(null), [])

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current) }, [])

  // Deliberately depend on request identity/destination only. Camera updates during
  // the approach must not tear down their own rAF and turn Beacon into a one-frame snap.
  useEffect(() => {
    const request = input.request
    if (!request || handledNonce.current === request.nonce) return
    if (request.targetTestId && request.targetTestId !== input.testId) return
    const wanted = new Set(request.ids)
    const targets = itemsRef.current.filter((item) => wanted.has(item.id))
    handledNonce.current = request.nonce
    if (!targets.length) return
    const root = document.querySelector<HTMLElement>(`[data-testid="${input.testId}"]`)
    const width = root?.clientWidth ?? 1000
    const height = root?.clientHeight ?? 760
    const bounds = spatialBoundsForPlacements(targets, 28)
    const destination = fitSpatialBounds(bounds, width, height, paddingRef.current ?? 90)
    const target = targets[0]!
    setBeacon({ nonce: request.nonce, phase: 'approach', target })

    const start = cameraRef.current
    if (!start || typeof requestAnimationFrame === 'undefined') {
      setCameraRef.current(destination)
      setBeacon({ nonce: request.nonce, phase: 'arrival', target })
      return
    }
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    const startedAt = performance.now()
    const duration = 320
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startedAt) / duration))
      const e = easeOutCubic(t)
      setCameraRef.current({
        x: start.x + (destination.x - start.x) * e,
        y: start.y + (destination.y - start.y) * e,
        zoom: start.zoom + (destination.zoom - start.zoom) * e,
      })
      if (t < 1) { raf.current = requestAnimationFrame(tick); return }
      raf.current = null
      setBeacon({ nonce: request.nonce, phase: 'arrival', target })
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null } }
  }, [input.request?.nonce, input.request?.targetTestId, input.testId])

  return { beacon, clearBeacon }
}
