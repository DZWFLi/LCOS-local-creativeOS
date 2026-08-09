import { describe, expect, it } from 'vitest'
import { applyWheelGesture, cameraSafeViewportBounds, fitBounds, fitBoundsForReading, getSelectionBounds, nodeDensity, nodeDimensions, restorationFocusBounds, restoredCameraIsMeaningful, revealNode, zoomCameraAt } from '../src/features/canvas/canvasGeometry'
import type { CanvasNode } from '../src/model'

const nodes: CanvasNode[] = [
  { id: 'a', kind: 'source', title: 'A', subtitle: '', x: 10, y: 20, width: 100, height: 80 },
  { id: 'b', kind: 'decision', title: 'B', subtitle: '', x: 160, y: 100, width: 120, height: 90 },
]

describe('canvas geometry', () => {
  it('derives persistent selection bounds from selected ids', () => expect(getSelectionBounds(nodes, ['a', 'b'])).toEqual({ x: 10, y: 20, width: 270, height: 170 }))
  it('fits content with padding and zoom clamp', () => expect(fitBounds({ x: 10, y: 20, width: 270, height: 170 }, 1000, 700).zoom).toBeGreaterThan(.38))
  it('keeps explicit overview fitting while restoring invalid cameras at a readable floor', () => {
    const bounds = { x: 0, y: 0, width: 4200, height: 2400 }
    expect(fitBounds(bounds, 1200, 800).zoom).toBeLessThan(.26)
    expect(fitBoundsForReading(bounds, 1200, 800).zoom).toBe(.58)
  })
  it('rejects a camera that technically sees content but renders every node as a thumbnail', () => {
    expect(restoredCameraIsMeaningful({ x: 400, y: 200, zoom: .25 }, nodes, 1200, 800)).toBe(false)
    expect(restoredCameraIsMeaningful({ x: 400, y: 200, zoom: 1 }, nodes, 1200, 800)).toBe(true)
  })
  it('restores to the densest content neighborhood instead of the empty center between islands', () => {
    const scattered = [
      { x: 0, y: 0, width: 260, height: 190 },
      { x: 340, y: 40, width: 260, height: 190 },
      { x: 140, y: 330, width: 260, height: 190 },
      { x: 3200, y: 0, width: 260, height: 190 },
      { x: 3540, y: 40, width: 260, height: 190 },
    ]
    expect(restorationFocusBounds(scattered)).toEqual({ x: 0, y: 0, width: 600, height: 520 })
  })
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
  it('uses a slower precision curve when Shift is held', () => {
    const camera = { x: 100, y: 50, zoom: 1 }
    const normal = applyWheelGesture(camera, { deltaX: 0, deltaY: -20, zoom: true, anchorX: 400, anchorY: 300 })
    const precision = applyWheelGesture(camera, { deltaX: 0, deltaY: -20, zoom: true, anchorX: 400, anchorY: 300, precision: true })
    expect(precision.zoom).toBeGreaterThan(camera.zoom)
    expect(precision.zoom).toBeLessThan(normal.zoom)
  })
  it('projects the minimap camera rectangle from the unobstructed shell safe area', () => {
    expect(cameraSafeViewportBounds({ x: 100, y: 50, zoom: .5 }, 1200, 800, { left: 60, right: 40, top: 50, bottom: 150 }))
      .toEqual({ x: -80, y: 0, width: 2200, height: 1200 })
  })
  it('clamps zoom to the 2 percent overview floor', () => {
    const next = applyWheelGesture({ x: 0, y: 0, zoom: .02 }, { deltaX: 0, deltaY: 1000, zoom: true, anchorX: 400, anchorY: 300 })
    expect(next.zoom).toBe(.02)
  })
  it('steps or resets around an explicit viewport anchor', () => {
    const next = zoomCameraAt({ x: 100, y: 50, zoom: 1 }, 1.05, 500, 350)
    expect(next.zoom).toBe(1.05)
    expect((500 - next.x) / next.zoom).toBeCloseTo(400)
    expect((350 - next.y) / next.zoom).toBeCloseTo(300)
  })
})
