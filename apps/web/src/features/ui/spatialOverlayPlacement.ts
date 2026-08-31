export interface SpatialOverlayRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface SpatialOverlaySize {
  readonly width: number
  readonly height: number
}

export interface SpatialOverlayInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export type SpatialOverlaySide = 'right' | 'left' | 'below' | 'above'

export interface SpatialOverlayPlacementInput {
  readonly targetBounds: SpatialOverlayRect
  readonly overlaySize: SpatialOverlaySize
  readonly viewport: SpatialOverlayRect
  readonly safeInsets?: Partial<SpatialOverlayInsets>
  readonly occupiedRects?: readonly SpatialOverlayRect[]
  readonly preferredSide?: SpatialOverlaySide
  readonly gap?: number
  readonly margin?: number
}

export interface SpatialOverlayPlacementResult extends SpatialOverlayRect {
  readonly side: SpatialOverlaySide
  readonly free: boolean
  readonly overlapArea: number
}

const ZERO_INSETS: SpatialOverlayInsets = { top: 0, right: 0, bottom: 0, left: 0 }
const DEFAULT_GAP = 10
const DEFAULT_MARGIN = 10
const TANGENT_OFFSETS = [0, -28, 28, -64, 64, -112, 112] as const
const NORMAL_OFFSETS = [0, 22, 48] as const
const SIDE_ORDER: readonly SpatialOverlaySide[] = ['right', 'below', 'left', 'above']

function right(rect: SpatialOverlayRect): number { return rect.left + rect.width }
function bottom(rect: SpatialOverlayRect): number { return rect.top + rect.height }
function centerX(rect: SpatialOverlayRect): number { return rect.left + rect.width / 2 }
function centerY(rect: SpatialOverlayRect): number { return rect.top + rect.height / 2 }

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.max(min, Math.min(max, value))
}

function intersectionArea(a: SpatialOverlayRect, b: SpatialOverlayRect): number {
  const width = Math.max(0, Math.min(right(a), right(b)) - Math.max(a.left, b.left))
  const height = Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top))
  return width * height
}

function expanded(rect: SpatialOverlayRect, gap: number): SpatialOverlayRect {
  return { left: rect.left - gap, top: rect.top - gap, width: rect.width + gap * 2, height: rect.height + gap * 2 }
}

function safeViewport(viewport: SpatialOverlayRect, input: SpatialOverlayPlacementInput): SpatialOverlayRect {
  const insets: SpatialOverlayInsets = { ...ZERO_INSETS, ...input.safeInsets }
  const margin = input.margin ?? DEFAULT_MARGIN
  const left = viewport.left + insets.left + margin
  const top = viewport.top + insets.top + margin
  const width = Math.max(0, viewport.width - insets.left - insets.right - margin * 2)
  const height = Math.max(0, viewport.height - insets.top - insets.bottom - margin * 2)
  return { left, top, width, height }
}

function sidePriority(side: SpatialOverlaySide, preferred?: SpatialOverlaySide): number {
  if (preferred === side) return 0
  const index = SIDE_ORDER.indexOf(side)
  const preferredIndex = preferred === undefined ? -1 : SIDE_ORDER.indexOf(preferred)
  if (preferredIndex < 0) return index * 12
  const distance = Math.min(Math.abs(index - preferredIndex), SIDE_ORDER.length - Math.abs(index - preferredIndex))
  return 24 + distance * 16
}

function candidateForSide(
  side: SpatialOverlaySide,
  target: SpatialOverlayRect,
  size: SpatialOverlaySize,
  gap: number,
  normalOffset: number,
  tangentOffset: number,
): SpatialOverlayRect {
  if (side === 'right') return {
    left: right(target) + gap + normalOffset,
    top: centerY(target) - size.height / 2 + tangentOffset,
    width: size.width,
    height: size.height,
  }
  if (side === 'left') return {
    left: target.left - size.width - gap - normalOffset,
    top: centerY(target) - size.height / 2 + tangentOffset,
    width: size.width,
    height: size.height,
  }
  if (side === 'below') return {
    left: centerX(target) - size.width / 2 + tangentOffset,
    top: bottom(target) + gap + normalOffset,
    width: size.width,
    height: size.height,
  }
  return {
    left: centerX(target) - size.width / 2 + tangentOffset,
    top: target.top - size.height - gap - normalOffset,
    width: size.width,
    height: size.height,
  }
}

function clampToViewport(rect: SpatialOverlayRect, viewport: SpatialOverlayRect): SpatialOverlayRect {
  const maxLeft = right(viewport) - rect.width
  const maxTop = bottom(viewport) - rect.height
  return {
    left: clamp(rect.left, viewport.left, maxLeft),
    top: clamp(rect.top, viewport.top, maxTop),
    width: rect.width,
    height: rect.height,
  }
}

function euclideanDistance(a: SpatialOverlayRect, b: SpatialOverlayRect): number {
  const dx = centerX(a) - centerX(b)
  const dy = centerY(a) - centerY(b)
  return Math.hypot(dx, dy)
}

/**
 * SpatialOverlayPlacement is a screen-space geometry owner for contextual UI.
 * It never mutates visual/layout bounds. It picks the nearest low-collision
 * rectangle beside the visual target while respecting safe canvas geometry.
 *
 * Runtime/Human QA still owns the final visual tuning at real Dock/Rail/Minimap
 * sizes; this function makes the geometry deterministic and testable first.
 */
export function resolveSpatialOverlayPlacement(input: SpatialOverlayPlacementInput): SpatialOverlayPlacementResult {
  const gap = input.gap ?? DEFAULT_GAP
  const viewport = safeViewport(input.viewport, input)
  const size = {
    width: Math.max(1, input.overlaySize.width),
    height: Math.max(1, input.overlaySize.height),
  }
  const targetObstacle = expanded(input.targetBounds, Math.max(4, gap * 0.6))
  const obstacles = [targetObstacle, ...(input.occupiedRects ?? []).map((rect) => expanded(rect, Math.max(4, gap * 0.5)))]

  let best: (SpatialOverlayPlacementResult & { score: number }) | null = null
  const seen = new Set<string>()

  for (const side of SIDE_ORDER) {
    for (const normalOffset of NORMAL_OFFSETS) {
      for (const tangentOffset of TANGENT_OFFSETS) {
        const raw = candidateForSide(side, input.targetBounds, size, gap, normalOffset, tangentOffset)
        const rect = clampToViewport(raw, viewport)
        const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${side}`
        if (seen.has(key)) continue
        seen.add(key)

        const overlapArea = obstacles.reduce((sum, obstacle) => sum + intersectionArea(rect, obstacle), 0)
        const clampTravel = Math.abs(rect.left - raw.left) + Math.abs(rect.top - raw.top)
        const distance = euclideanDistance(rect, input.targetBounds)
        const free = overlapArea <= 0.01
        const score = overlapArea * 100_000
          + sidePriority(side, input.preferredSide)
          + distance
          + clampTravel * 6
          + normalOffset * 0.4
          + Math.abs(tangentOffset) * 0.18

        const scored = { ...rect, side, free, overlapArea, score }
        if (best === null || score < best.score) best = scored
        if (free && normalOffset === 0 && tangentOffset === 0 && side === input.preferredSide) {
          const { score: _score, ...result } = scored
          return result
        }
      }
    }
  }

  if (best === null) {
    return { left: viewport.left, top: viewport.top, width: size.width, height: size.height, side: input.preferredSide ?? 'right', free: false, overlapArea: 0 }
  }
  const { score: _score, ...result } = best
  return result
}

export function spatialOverlayRectFromDomRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): SpatialOverlayRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export function spatialOverlayRectIntersects(a: SpatialOverlayRect, b: SpatialOverlayRect): boolean {
  return intersectionArea(a, b) > 0
}
