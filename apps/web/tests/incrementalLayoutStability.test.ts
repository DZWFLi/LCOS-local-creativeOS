import { describe, expect, it } from 'vitest'

import { movedLayoutIds } from '../src/features/layout/layoutGeometry'

describe('Incremental layout stability (Phase C C5)', () => {
  it('reports only newly moved ids when adding nodes to a stable layout', () => {
    const before = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
      { id: 'c', x: 400, y: 0 },
    ]
    const after = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
      { id: 'c', x: 400, y: 0 },
      { id: 'd', x: 600, y: 0 },
    ]
    // Incremental stability rule: existing nodes keep their positions; the new
    // node is not reported as a "move" of an existing anchor.
    const moved = movedLayoutIds(before.map((position, index) => ({ ...position, width: 100, height: 50, pinned: index === 0 })), after)
    expect(moved).toEqual([])
    expect(after.some((position) => position.id === 'd')).toBe(true)
  })

  it('never moves pinned anchors', () => {
    const before = [
      { id: 'pin', x: 40, y: 40 },
      { id: 'free', x: 0, y: 0 },
    ]
    const after = [
      { id: 'pin', x: 40, y: 40 },
      { id: 'free', x: 300, y: 120 },
    ]
    const moved = movedLayoutIds(before.map((position, index) => ({ ...position, width: 100, height: 50, pinned: index === 0 })), after)
    expect(moved).toEqual(['free'])
  })
})
