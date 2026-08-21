import { describe, expect, it } from 'vitest'
import { findPendingReturnPosition, getPendingZoneBounds } from '../src/features/canvas/canvasLayout'
import type { CanvasNode } from '../src/model'

const target: CanvasNode = { id: 'working', kind: 'working', title: '当前工作稿', subtitle: '', x: 400, y: 260, width: 320, height: 246 }

describe('pending return layout', () => {
  it('places a result to the right of the target', () => {
    expect(findPendingReturnPosition([target], target, { width: 264, height: 190 })).toEqual({ x: 816, y: 250 })
  })

  it('moves a second result to the next free row instead of overlapping', () => {
    const first: CanvasNode = { id: 'draft-1', kind: 'generated', title: '草稿 1', subtitle: '', x: 816, y: 250, width: 264, height: 190, draft: true }
    expect(findPendingReturnPosition([target, first], target, { width: 264, height: 190 })).toEqual({ x: 1134, y: 250 })
  })

  it('derives a padded pending zone around all draft results', () => {
    const drafts: CanvasNode[] = [
      { id: 'draft-1', kind: 'generated', title: '草稿 1', subtitle: '', x: 816, y: 250, width: 264, height: 190, draft: true },
      { id: 'draft-2', kind: 'generated', title: '草稿 2', subtitle: '', x: 816, y: 464, width: 264, height: 190, draft: true },
    ]
    expect(getPendingZoneBounds(drafts)).toEqual({ x: 788, y: 204, width: 320, height: 478 })
  })
})
