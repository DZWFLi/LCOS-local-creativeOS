import { describe, expect, it } from 'vitest'
import { projectSpatialBeacon } from '../spatialBeaconGeometry'

const camera = { x: 0, y: 0, zoom: 1 }
const viewport = { width: 1000, height: 800 }
const node = (x: number, y: number) => ({ id: 'target', x, y, width: 100, height: 80 })

describe('Spatial Beacon geometry', () => {
  it('keeps an onscreen target at its true screen center', () => {
    expect(projectSpatialBeacon(node(450, 360), camera, viewport)).toMatchObject({ x: 500, y: 400, offscreen: false })
  })

  it('clamps an offscreen target to the edge while preserving direction', () => {
    const projected = projectSpatialBeacon(node(1500, 360), camera, viewport, 30)
    expect(projected.offscreen).toBe(true)
    expect(projected.x).toBeCloseTo(970, 5)
    expect(projected.y).toBeCloseTo(400, 5)
    expect(projected.angleRad).toBeCloseTo(0, 5)
  })

  it('uses the ray to the target instead of independently clamping x/y', () => {
    const projected = projectSpatialBeacon(node(1500, -800), camera, viewport, 30)
    expect(projected.offscreen).toBe(true)
    expect(projected.x).toBeLessThanOrEqual(970)
    expect(projected.y).toBeCloseTo(30, 5)
    expect(projected.x).toBeGreaterThan(500)
  })
})
