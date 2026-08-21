import { describe, expect, it } from 'vitest'
import { ensureGridOrder, reorderGridMember, setSpatialLayoutMode } from '../src/state/presentationLayout'
import type { PresentationStateV0 } from '@local-creative-os/contracts'

const base = (): PresentationStateV0 => ({
  memberViewIds: ['a', 'b'],
  positions: { a: { x: 11, y: 22 }, b: { x: 33, y: 44 } },
  pinnedViewIds: [],
  hiddenViewIds: [],
  emphasisByViewId: {},
  presentationEdges: [],
  hierarchy: { parentByViewId: {}, orderByParent: {} },
})

describe('presentation layout modes', () => {
  it('keeps freeform positions intact when switching modes', () => {
    const grid = setSpatialLayoutMode(base(), 'grid')
    const free = setSpatialLayoutMode(grid, 'freeform')
    expect(free.positions).toEqual(base().positions)
    expect(grid.gridLayout?.order).toEqual(['a', 'b'])
  })

  it('can order aggregate projection ids without mutating semantic membership', () => {
    const state = ensureGridOrder(base(), ['a', 'scope:c1', 'workspace:w1'])
    expect(state.memberViewIds).toEqual(['a', 'b'])
    expect(state.gridLayout?.order).toEqual(['a', 'scope:c1', 'workspace:w1'])
  })

  it('reorders the visible projection only', () => {
    const state = reorderGridMember(base(), 'a', 'scope:c1', ['a', 'b', 'scope:c1'])
    expect(state.gridLayout?.order).toEqual(['b', 'scope:c1', 'a'])
    expect(state.memberViewIds).toEqual(['a', 'b'])
  })
})
