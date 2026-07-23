import { describe, expect, it } from 'vitest'
import { applyWheelGesture, fitBounds, getSelectionBounds, nodeDensity, nodeDimensions, revealNode } from '../src/features/canvas/canvasGeometry'
import type { CanvasNode } from '../src/model'

const nodes: CanvasNode[] = [
  { id: 'a', kind: 'source', title: 'A', subtitle: '', x: 10, y: 20, width: 100, height: 80 },
  { id: 'b', kind: 'decision', title: 'B', subtitle: '', x: 160, y: 100, width: 120, height: 90 },
]

describe('canvas geometry', () => {
  it('derives persistent selection bounds from selected ids', () => expect(getSelectionBounds(nodes, ['a', 'b'])).toEqual({ x: 10, y: 20, width: 270, height: 170 }))
  it('fits content with padding and zoom clamp', () => expect(fitBounds({ x: 10, y: 20, width: 270, height: 170 }, 1000, 700).zoom).toBeGreaterThan(.38))
  it('uses explicit density modes and keeps overview compact', () => {
    expect(nodeDensity({ ...nodes[0], displayMode: 'expanded' }, 'full')).toBe('expanded')
    expect(nodeDensity({ ...nodes[0], displayMode: 'expanded' }, 'overview')).toBe('compact')
  })
  it('maps node families to bounded density dimensions', () => {
    expect(nodeDimensions('source', 'compact')).toEqual({ width: 196, height: 108 })
    expect(nodeDimensions('source', 'expanded')).toEqual({ width: 320, height: 246 })
    expect(nodeDimensions('process', 'standard')).toEqual({ width: 238, height: 82 })
  })
  it('pans just enough to reveal a newly returned artifact', () => {
    const next = revealNode({ x: 214, y: 62, zoom: 1.08 }, { x: 1166, y: 276, width: 264, height: 190 }, 1440, 848)
    expect(next.x).toBeLessThan(0)
    expect(next.zoom).toBe(1.08)
  })
  it('pans at half sensitivity with a two-finger wheel gesture without changing zoom', () => expect(applyWheelGesture({ x: 120, y: 80, zoom: 1 }, { deltaX: 24, deltaY: -36, zoom: false, anchorX: 0, anchorY: 0 })).toEqual({ x: 108, y: 98, zoom: 1 }))
  it('keeps the pointer anchor stable during a trackpad pinch', () => {
    const camera = { x: 100, y: 50, zoom: 1 }
    const next = applyWheelGesture(camera, { deltaX: 0, deltaY: -20, zoom: true, anchorX: 400, anchorY: 300 })
    expect((400 - next.x) / next.zoom).toBeCloseTo(300)
    expect((300 - next.y) / next.zoom).toBeCloseTo(250)
    expect(next.zoom).toBeGreaterThan(camera.zoom)
  })
})
