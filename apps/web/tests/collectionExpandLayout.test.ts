import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../src/model'
import { layoutExpandedCollectionMembers } from '../src/features/canvas/collectionExpandLayout'

const node = (id: string, x: number, y: number, width = 220, height = 120): CanvasNode => ({
  id, kind: 'note', title: id, subtitle: '', x, y, width, height, displayMode: 'standard', createdAt: '2026-08-15T00:00:00.000Z',
})

describe('expanded Collection presentation layout', () => {
  it('keeps members in a readable non-overlapping block near the Collection', () => {
    const container = { ...node('collection', 100, 100, 250, 146), kind: 'context' as const, entityKind: 'collection' as const }
    const members = [node('a', 0, 0, 280, 130), node('b', 20, 30, 180, 110), node('c', 50, 70, 240, 160), node('d', 60, 90, 200, 100)]
    const result = layoutExpandedCollectionMembers(container, members, [])
    expect(result.size).toBe(4)
    const byId = result
    expect(byId.get('a')!.x).toBeGreaterThan(container.x + container.width)
    const a = byId.get('a')!, b = byId.get('b')!
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(40)
  })

  it('moves the projection away from unrelated nearby obstacles instead of covering them', () => {
    const container = { ...node('collection', 100, 100, 250, 146), kind: 'context' as const, entityKind: 'collection' as const }
    const members = [node('a', 0, 0), node('b', 20, 20)]
    const obstacle = node('unrelated', 385, 80, 520, 360)
    const result = layoutExpandedCollectionMembers(container, members, [obstacle])
    expect([...result.values()].some((item) => item.x >= obstacle.x && item.x <= obstacle.x + obstacle.width && item.y >= obstacle.y && item.y <= obstacle.y + obstacle.height)).toBe(false)
  })
})
