export type DropIntentAnchor = 'left' | 'bottom'

export const DROP_INTENT_TOKENS = {
  edgeScrollBand: 96,
  dwellBand: 44,
  dwellMs: 520,
  dwellRadius: 8,
  cancelDistance: 14,
  edgeScrollMaxPxPerFrame: 18,
} as const

export interface DropPoint {
  readonly x: number
  readonly y: number
}

export interface DropBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export type DropIntentState =
  | { readonly status: 'idle' }
  | { readonly status: 'dwell'; readonly anchor: DropIntentAnchor; readonly origin: DropPoint; readonly startedAt: number }
  | { readonly status: 'preview'; readonly anchor: DropIntentAnchor }

export const idleDropIntent = (): DropIntentState => ({ status: 'idle' })

export function dropDwellAnchorAt(point: DropPoint, bounds: DropBounds): DropIntentAnchor | null {
  if (point.y >= bounds.bottom - DROP_INTENT_TOKENS.dwellBand && point.y < bounds.bottom) return 'bottom'
  if (point.x >= bounds.left && point.x <= bounds.left + DROP_INTENT_TOKENS.dwellBand) return 'left'
  return null
}

export function inDropPreviewCarryZone(point: DropPoint, bounds: DropBounds, anchor: DropIntentAnchor): boolean {
  const hysteresis = DROP_INTENT_TOKENS.cancelDistance
  if (anchor === 'bottom') {
    return point.y >= bounds.bottom - DROP_INTENT_TOKENS.edgeScrollBand - hysteresis && point.y < bounds.bottom + hysteresis
  }
  return point.x >= bounds.left - hysteresis && point.x <= bounds.left + DROP_INTENT_TOKENS.edgeScrollBand + hysteresis
}

export function advanceDropIntent(
  state: DropIntentState,
  point: DropPoint,
  bounds: DropBounds,
  now: number,
  overDestination = false,
): DropIntentState {
  if (state.status === 'preview') {
    return overDestination || inDropPreviewCarryZone(point, bounds, state.anchor) ? state : idleDropIntent()
  }

  const anchor = dropDwellAnchorAt(point, bounds)
  if (!anchor) return idleDropIntent()

  if (state.status === 'dwell' && state.anchor === anchor) {
    const drift = Math.hypot(point.x - state.origin.x, point.y - state.origin.y)
    if (drift <= DROP_INTENT_TOKENS.dwellRadius) return state
  }

  return { status: 'dwell', anchor, origin: point, startedAt: now }
}

export function completeDropDwell(state: DropIntentState, now: number): DropIntentState {
  if (state.status !== 'dwell') return state
  if (now - state.startedAt < DROP_INTENT_TOKENS.dwellMs) return state
  return { status: 'preview', anchor: state.anchor }
}

export function dropDwellRemainingMs(state: DropIntentState, now: number): number {
  if (state.status !== 'dwell') return 0
  return Math.max(0, DROP_INTENT_TOKENS.dwellMs - (now - state.startedAt))
}
