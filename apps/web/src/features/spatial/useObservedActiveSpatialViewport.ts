import { useLayoutEffect, useMemo, useState } from 'react'
import { resolveActiveSpatialViewport, type ActiveSpatialViewportEnvironment, type SpatialViewportOccupiedRect } from './activeSpatialViewport'
import type { SpatialInsets } from './spatialTypes'

export const SPATIAL_VIEWPORT_OCCUPANT_ATTRIBUTE = 'data-spatial-viewport-occupant'
const OCCUPANT_SELECTOR = `[${SPATIAL_VIEWPORT_OCCUPANT_ATTRIBUTE}]`

type Input = {
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly staticInsets: SpatialInsets
}

function sameEnvironment(a: ActiveSpatialViewportEnvironment, b: ActiveSpatialViewportEnvironment): boolean {
  return a.activeSpatialRect.left === b.activeSpatialRect.left
    && a.activeSpatialRect.top === b.activeSpatialRect.top
    && a.activeSpatialRect.width === b.activeSpatialRect.width
    && a.activeSpatialRect.height === b.activeSpatialRect.height
    && a.persistentOccupiedRects.length === b.persistentOccupiedRects.length
    && a.persistentOccupiedRects.every((rect, index) => {
      const other = b.persistentOccupiedRects[index]
      return other !== undefined
        && rect.left === other.left
        && rect.top === other.top
        && rect.width === other.width
        && rect.height === other.height
        && rect.edge === other.edge
    })
}

function edgeFor(element: Element): SpatialViewportOccupiedRect['edge'] {
  const edge = element.getAttribute(SPATIAL_VIEWPORT_OCCUPANT_ATTRIBUTE)
  return edge === 'left' || edge === 'right' || edge === 'top' || edge === 'bottom' ? edge : undefined
}

function occupiedRects(): SpatialViewportOccupiedRect[] {
  if (typeof document === 'undefined') return []
  return [...document.querySelectorAll<HTMLElement>(OCCUPANT_SELECTOR)].flatMap((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const edge = edgeFor(element)
    return [{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, ...(edge ? { edge } : {}) }]
  })
}

export function useObservedActiveSpatialViewport(input: Input): ActiveSpatialViewportEnvironment {
  const fallback = useMemo(() => resolveActiveSpatialViewport({
    viewportRect: { left: 0, top: 0, width: input.viewportWidth, height: input.viewportHeight },
    staticInsets: input.staticInsets,
  }), [input.staticInsets.bottom, input.staticInsets.left, input.staticInsets.right, input.staticInsets.top, input.viewportHeight, input.viewportWidth])
  const [environment, setEnvironment] = useState(fallback)

  useLayoutEffect(() => {
    if (typeof document === 'undefined') { setEnvironment(fallback); return }
    let frame: number | null = null
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())

    const measure = () => {
      frame = null
      const next = resolveActiveSpatialViewport({
        viewportRect: { left: 0, top: 0, width: input.viewportWidth, height: input.viewportHeight },
        staticInsets: input.staticInsets,
        persistentOccupiedRects: occupiedRects(),
      })
      setEnvironment((current) => sameEnvironment(current, next) ? current : next)
    }
    const refreshObservedElements = () => {
      resizeObserver?.disconnect()
      for (const element of document.querySelectorAll<HTMLElement>(OCCUPANT_SELECTOR)) resizeObserver?.observe(element)
      schedule()
    }
    const schedule = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(measure)
    }

    refreshObservedElements()
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refreshObservedElements)
    mutationObserver?.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [fallback, input.staticInsets.bottom, input.staticInsets.left, input.staticInsets.right, input.staticInsets.top, input.viewportHeight, input.viewportWidth])

  return environment
}
