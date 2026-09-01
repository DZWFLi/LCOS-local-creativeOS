export type CenteredSpatialIndexOwner = 'search' | 'focus' | 'color-pin' | 'assembly' | 'none'
export type CenteredSpatialIndexVariant = Exclude<CenteredSpatialIndexOwner, 'none'>

export interface CenteredSpatialIndexArbitrationInput {
  readonly searchActive: boolean
  readonly focusActive: boolean
  readonly colorPinCount: number
}

export interface CenteredSpatialIndexItem {
  readonly id: string
  readonly label: string
  readonly shortLabel?: string
  readonly count?: number
  readonly active?: boolean
  readonly tone?: string
  readonly hint?: string
  readonly presentation?: 'marker' | 'result'
}

export interface CenteredSpatialIndexOffset {
  readonly x: number
  readonly y: number
}

export interface CenteredSpatialIndexLayoutItem extends CenteredSpatialIndexItem {
  readonly x: number
  readonly y: number
}

export interface CenteredSpatialIndexLayout {
  readonly visibleItems: readonly CenteredSpatialIndexLayoutItem[]
  readonly overflowCount: number
  readonly overflowOffset?: CenteredSpatialIndexOffset
}

export const CENTERED_SPATIAL_INDEX_PRIMARY_CAP = 7

/**
 * Main / Context / Workflow share one dominant top slot.
 * Search is transient retrieval and therefore yields only to nothing;
 * Focus yields to Search; persistent Color Pin truth visually yields to both.
 * Assembly uses the same primitive in its own Workspace and does not enter this arbiter.
 */
export function resolveTopSpatialIndexOwner(input: CenteredSpatialIndexArbitrationInput): CenteredSpatialIndexOwner {
  if (input.searchActive) return 'search'
  if (input.focusActive) return 'focus'
  if (input.colorPinCount > 0) return 'color-pin'
  return 'none'
}

const TEMPLATES: Readonly<Record<number, readonly CenteredSpatialIndexOffset[]>> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -22, y: 4 }, { x: 22, y: 4 }],
  3: [{ x: 0, y: 0 }, { x: -31, y: 20 }, { x: 31, y: 20 }],
  4: [{ x: -29, y: 0 }, { x: 29, y: 0 }, { x: -14, y: 20 }, { x: 14, y: 20 }],
  5: [{ x: 0, y: 0 }, { x: -36, y: 9 }, { x: 36, y: 9 }, { x: -19, y: 27 }, { x: 19, y: 27 }],
  6: [{ x: -38, y: 3 }, { x: 0, y: 0 }, { x: 38, y: 3 }, { x: -29, y: 24 }, { x: 0, y: 29 }, { x: 29, y: 24 }],
  7: [{ x: 0, y: 0 }, { x: -40, y: 5 }, { x: 40, y: 5 }, { x: -57, y: 24 }, { x: -20, y: 30 }, { x: 20, y: 30 }, { x: 57, y: 24 }],
}

/** Deterministic, center-symmetric, shallow constellation geometry. */
export function centeredSpatialIndexOffsets(count: number): readonly CenteredSpatialIndexOffset[] {
  if (!Number.isFinite(count) || count <= 0) return []
  const safeCount = Math.min(CENTERED_SPATIAL_INDEX_PRIMARY_CAP, Math.max(1, Math.floor(count)))
  return TEMPLATES[safeCount] ?? []
}

export function layoutCenteredSpatialIndex(
  items: readonly CenteredSpatialIndexItem[],
  cap = CENTERED_SPATIAL_INDEX_PRIMARY_CAP,
): CenteredSpatialIndexLayout {
  const primaryCap = Math.max(1, Math.min(CENTERED_SPATIAL_INDEX_PRIMARY_CAP, Math.floor(cap)))
  const hasOverflow = items.length > primaryCap
  const visibleCap = hasOverflow ? Math.max(1, primaryCap - 1) : primaryCap
  const visible = items.slice(0, visibleCap)
  const overflowCount = Math.max(0, items.length - visible.length)
  const slotCount = visible.length + (overflowCount > 0 ? 1 : 0)
  const offsets = centeredSpatialIndexOffsets(slotCount)
  return {
    visibleItems: visible.map((item, index) => ({ ...item, ...offsets[index]! })),
    overflowCount,
    ...(overflowCount > 0 ? { overflowOffset: offsets[offsets.length - 1]! } : {}),
  }
}
