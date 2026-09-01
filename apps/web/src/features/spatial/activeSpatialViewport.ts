import type { SpatialInsets, SpatialPoint } from './spatialTypes'

export type SpatialViewportEdge = 'left' | 'right' | 'top' | 'bottom'

export interface SpatialViewportRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface SpatialViewportOccupiedRect extends SpatialViewportRect {
  /** Persistent edge owner. Work View should publish this explicitly. */
  readonly edge?: SpatialViewportEdge
}

export interface SpatialViewportEnvironmentInput {
  readonly viewportRect: SpatialViewportRect
  readonly staticInsets?: Partial<SpatialInsets>
  readonly persistentOccupiedRects?: readonly SpatialViewportOccupiedRect[]
  readonly edgeTolerance?: number
}

export interface SpatialViewportEdgeBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export interface ActiveSpatialViewportEnvironment {
  readonly viewportRect: SpatialViewportRect
  readonly staticInsets: SpatialInsets
  readonly persistentOccupiedRects: readonly SpatialViewportOccupiedRect[]
  readonly activeSpatialRect: SpatialViewportRect
  readonly activeInsets: SpatialInsets
  readonly topCenterAnchor: SpatialPoint
  readonly edgeBounds: SpatialViewportEdgeBounds
}

const ZERO_INSETS: SpatialInsets = { left: 0, right: 0, top: 0, bottom: 0 }
const DEFAULT_EDGE_TOLERANCE = 2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function right(rect: SpatialViewportRect): number { return rect.left + rect.width }
function bottom(rect: SpatialViewportRect): number { return rect.top + rect.height }

function normalizedRect(rect: SpatialViewportRect): SpatialViewportRect {
  return {
    left: Number.isFinite(rect.left) ? rect.left : 0,
    top: Number.isFinite(rect.top) ? rect.top : 0,
    width: Number.isFinite(rect.width) ? Math.max(0, rect.width) : 0,
    height: Number.isFinite(rect.height) ? Math.max(0, rect.height) : 0,
  }
}

function intersects(a: SpatialViewportRect, b: SpatialViewportRect): boolean {
  return Math.min(right(a), right(b)) > Math.max(a.left, b.left)
    && Math.min(bottom(a), bottom(b)) > Math.max(a.top, b.top)
}

function inferOccupiedEdge(
  rect: SpatialViewportOccupiedRect,
  viewport: SpatialViewportRect,
  tolerance: number,
): SpatialViewportEdge | null {
  if (rect.edge) return rect.edge
  const touchesLeft = rect.left <= viewport.left + tolerance
  const touchesRight = right(rect) >= right(viewport) - tolerance
  const touchesTop = rect.top <= viewport.top + tolerance
  const touchesBottom = bottom(rect) >= bottom(viewport) - tolerance

  const horizontalShape = rect.width >= rect.height
  const verticalShape = rect.height > rect.width

  if (verticalShape && touchesLeft !== touchesRight) return touchesLeft ? 'left' : 'right'
  if (horizontalShape && touchesTop !== touchesBottom) return touchesTop ? 'top' : 'bottom'

  const touched: SpatialViewportEdge[] = []
  if (touchesLeft) touched.push('left')
  if (touchesRight) touched.push('right')
  if (touchesTop) touched.push('top')
  if (touchesBottom) touched.push('bottom')
  return touched.length === 1 ? touched[0]! : null
}

function baseSpatialRect(viewport: SpatialViewportRect, insets: SpatialInsets): SpatialViewportRect {
  const left = viewport.left + clamp(insets.left, 0, viewport.width)
  const top = viewport.top + clamp(insets.top, 0, viewport.height)
  const maxRight = right(viewport) - clamp(insets.right, 0, viewport.width)
  const maxBottom = bottom(viewport) - clamp(insets.bottom, 0, viewport.height)
  return {
    left,
    top,
    width: Math.max(0, maxRight - left),
    height: Math.max(0, maxBottom - top),
  }
}

/**
 * Canonical screen-space geometry owner for the usable SpatialCanvas region.
 *
 * Persistent edge UI (future Unified Work View, durable rails/docks) may reduce
 * the interactive spatial rectangle, but this resolver never receives or
 * mutates Camera state. HUD/navigation can reflow around the returned region;
 * Camera movement remains an explicit caller action such as Focus.
 */
export function resolveActiveSpatialViewport(input: SpatialViewportEnvironmentInput): ActiveSpatialViewportEnvironment {
  const viewportRect = normalizedRect(input.viewportRect)
  const staticInsets: SpatialInsets = { ...ZERO_INSETS, ...input.staticInsets }
  const base = baseSpatialRect(viewportRect, staticInsets)
  const tolerance = Math.max(0, input.edgeTolerance ?? DEFAULT_EDGE_TOLERANCE)
  const persistentOccupiedRects = (input.persistentOccupiedRects ?? [])
    .map((rect) => ({ ...normalizedRect(rect), ...(rect.edge ? { edge: rect.edge } : {}) }))
    .filter((rect) => rect.width > 0 && rect.height > 0 && intersects(rect, viewportRect))

  let leftEdge = base.left
  let rightEdge = right(base)
  let topEdge = base.top
  let bottomEdge = bottom(base)

  for (const rect of persistentOccupiedRects) {
    if (!intersects(rect, base)) continue
    const edge = inferOccupiedEdge(rect, viewportRect, tolerance)
    if (edge === 'left') leftEdge = Math.max(leftEdge, clamp(right(rect), base.left, rightEdge))
    if (edge === 'right') rightEdge = Math.min(rightEdge, clamp(rect.left, leftEdge, right(base)))
    if (edge === 'top') topEdge = Math.max(topEdge, clamp(bottom(rect), base.top, bottomEdge))
    if (edge === 'bottom') bottomEdge = Math.min(bottomEdge, clamp(rect.top, topEdge, bottom(base)))
  }

  const activeSpatialRect: SpatialViewportRect = {
    left: leftEdge,
    top: topEdge,
    width: Math.max(0, rightEdge - leftEdge),
    height: Math.max(0, bottomEdge - topEdge),
  }
  const activeInsets: SpatialInsets = {
    left: Math.max(0, activeSpatialRect.left - viewportRect.left),
    right: Math.max(0, right(viewportRect) - right(activeSpatialRect)),
    top: Math.max(0, activeSpatialRect.top - viewportRect.top),
    bottom: Math.max(0, bottom(viewportRect) - bottom(activeSpatialRect)),
  }
  const edgeBounds: SpatialViewportEdgeBounds = {
    left: activeSpatialRect.left,
    right: right(activeSpatialRect),
    top: activeSpatialRect.top,
    bottom: bottom(activeSpatialRect),
  }

  return {
    viewportRect,
    staticInsets,
    persistentOccupiedRects,
    activeSpatialRect,
    activeInsets,
    topCenterAnchor: {
      x: activeSpatialRect.left + activeSpatialRect.width / 2,
      y: activeSpatialRect.top,
    },
    edgeBounds,
  }
}

export interface SpatialViewportRectLike {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** Convert the project-level active viewport into insets local to any Surface root. */
export function spatialInsetsWithinRect(
  environment: ActiveSpatialViewportEnvironment,
  rect: SpatialViewportRectLike,
): SpatialInsets {
  const width = Math.max(0, rect.right - rect.left)
  const height = Math.max(0, rect.bottom - rect.top)
  const activeRight = environment.activeSpatialRect.left + environment.activeSpatialRect.width
  const activeBottom = environment.activeSpatialRect.top + environment.activeSpatialRect.height
  return {
    left: clamp(environment.activeSpatialRect.left - rect.left, 0, width),
    right: clamp(rect.right - activeRight, 0, width),
    top: clamp(environment.activeSpatialRect.top - rect.top, 0, height),
    bottom: clamp(rect.bottom - activeBottom, 0, height),
  }
}

/** Edge-scroll and pointer HUD consumers operate in client coordinates. */
export function spatialEdgeBoundsWithinRect(
  environment: ActiveSpatialViewportEnvironment,
  rect: SpatialViewportRectLike,
): SpatialViewportEdgeBounds {
  return {
    left: clamp(environment.edgeBounds.left, rect.left, rect.right),
    right: clamp(environment.edgeBounds.right, rect.left, rect.right),
    top: clamp(environment.edgeBounds.top, rect.top, rect.bottom),
    bottom: clamp(environment.edgeBounds.bottom, rect.top, rect.bottom),
  }
}
