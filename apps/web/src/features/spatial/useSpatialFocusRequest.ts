import { useEffect, useRef } from 'react'
import type { Camera } from '../../model'
import { fitSpatialBounds, spatialBoundsForPlacements } from './spatialCamera'

export interface SpatialFocusRequest {
  readonly nonce: number
  readonly ids: readonly string[]
}

export interface SpatialFocusItem {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Camera-only focus. It never changes Selection or Presentation membership. */
export function useSpatialFocusRequest(input: {
  readonly request?: SpatialFocusRequest
  readonly items: readonly SpatialFocusItem[]
  readonly testId: string
  readonly setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  readonly padding?: number
}): void {
  const handledNonce = useRef<number>(-1)
  useEffect(() => {
    const request = input.request
    if (!request || handledNonce.current === request.nonce) return
    const wanted = new Set(request.ids)
    const targets = input.items.filter((item) => wanted.has(item.id))
    handledNonce.current = request.nonce
    if (!targets.length) return
    const root = document.querySelector<HTMLElement>(`[data-testid="${input.testId}"]`)
    const width = root?.clientWidth ?? 1000
    const height = root?.clientHeight ?? 760
    const bounds = spatialBoundsForPlacements(targets, 28)
    input.setCamera(fitSpatialBounds(bounds, width, height, input.padding ?? 90))
  }, [input.items, input.padding, input.request, input.setCamera, input.testId])
}
