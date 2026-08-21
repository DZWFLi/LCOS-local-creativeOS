import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../src/model'
import { projectNodesToGrid, reorderGridOrder } from '../src/features/canvas/gridLayout'

const node = (id: string, x: number, y = 80, width = 180, height = 100): CanvasNode => ({ id, kind:'note', title:id, subtitle:'', x, y, width, height })

describe('soft grid presentation', () => {
  it('snaps locally without mutating Freeform coordinates or dense-repacking the canvas', () => {
    const source = [node('a', 91, 83), node('b', 403, 88)]
    const before = source.map(({x,y}) => ({x,y}))
    const projected = projectNodesToGrid(source, ['a','b'], { snapX:24, snapY:20, gapX:28, gapY:24 })
    expect(projected.map((item) => item.id)).toEqual(['a','b'])
    expect(Math.abs(projected[0]!.x - 91)).toBeLessThanOrEqual(24)
    expect(Math.abs(projected[1]!.x - 403)).toBeLessThanOrEqual(24)
    expect(projected[1]!.x - projected[0]!.x).toBeGreaterThan(250)
    expect(source.map(({x,y}) => ({x,y}))).toEqual(before)
  })

  it('respects real node bounds while repairing a local collision', () => {
    const projected = projectNodesToGrid([node('a',100,100,300,120),node('b',360,110,220,160)], ['a','b'])
    const [a,b] = projected
    const separated = a!.x + a!.width + 8 <= b!.x || b!.x + b!.width + 8 <= a!.x || a!.y + a!.height + 8 <= b!.y || b!.y + b!.height + 8 <= a!.y
    expect(separated).toBe(true)
  })

  it('reorders by displacement target', () => {
    expect(reorderGridOrder(['a','b','c','d'], 'a', 'c')).toEqual(['b','c','a','d'])
  })
})
