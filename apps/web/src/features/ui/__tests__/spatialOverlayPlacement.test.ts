import { describe, expect, it } from 'vitest'
import { resolveSpatialOverlayPlacement } from '../spatialOverlayPlacement'

const VIEWPORT = { left: 0, top: 0, width: 1000, height: 700 }
const SIZE = { width: 240, height: 160 }

describe('SpatialOverlayPlacement', () => {
  it('uses the preferred side when it is free', () => {
    const result = resolveSpatialOverlayPlacement({
      targetBounds: { left: 200, top: 200, width: 120, height: 80 },
      overlaySize: SIZE,
      viewport: VIEWPORT,
      preferredSide: 'right',
    })
    expect(result.side).toBe('right')
    expect(result.left).toBeGreaterThan(320)
    expect(result.free).toBe(true)
  })

  it('moves to another nearby side when the preferred side is occupied', () => {
    const result = resolveSpatialOverlayPlacement({
      targetBounds: { left: 360, top: 220, width: 120, height: 80 },
      overlaySize: SIZE,
      viewport: VIEWPORT,
      occupiedRects: [{ left: 480, top: 120, width: 330, height: 300 }],
      preferredSide: 'right',
    })
    expect(result.free).toBe(true)
    expect(result.side).not.toBe('right')
  })

  it('respects safe insets and never places into the dock region', () => {
    const result = resolveSpatialOverlayPlacement({
      targetBounds: { left: 410, top: 540, width: 120, height: 80 },
      overlaySize: SIZE,
      viewport: VIEWPORT,
      safeInsets: { bottom: 72 },
      preferredSide: 'below',
    })
    expect(result.top + result.height).toBeLessThanOrEqual(700 - 72 - 10)
  })

  it('keeps placement deterministic for identical geometry', () => {
    const input = {
      targetBounds: { left: 820, top: 560, width: 120, height: 80 },
      overlaySize: SIZE,
      viewport: VIEWPORT,
      occupiedRects: [{ left: 760, top: 400, width: 220, height: 140 }],
      preferredSide: 'right' as const,
    }
    expect(resolveSpatialOverlayPlacement(input)).toEqual(resolveSpatialOverlayPlacement(input))
  })
})
