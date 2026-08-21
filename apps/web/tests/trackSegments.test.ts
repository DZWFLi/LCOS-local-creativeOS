import { describe, expect, it } from 'vitest'
import {
  addTrackSegmentMembers,
  createSegmentsFromStrands,
  ensureTrackSegmentsCoverMembers,
  insertTrackSegment,
  mergeTrackSegments,
  normalizeTrackSegments,
  removeTrackSegmentMember,
  reorderTrackSegment,
  splitTrackSegment,
  toggleTrackSegmentCollapsed,
  trackSegmentDensity,
} from '../src/features/context/trackSegments'
import type { ContextTrackSegmentV0 } from '@local-creative-os/contracts'

const segment = (id: string, memberViewIds: string[], order = 0): ContextTrackSegmentV0 => ({ id, memberViewIds, order, collapsed: false })

describe('Phase 3 Slice 3 — Signal Track segments', () => {
  it('seeds segments from strands with obvious order', () => {
    const segments = createSegmentsFromStrands([
      { id: 's1', objectIds: ['a', 'b'] },
      { id: 's2', objectIds: ['c'] },
    ])
    expect(segments.map((s) => s.order)).toEqual([0, 1])
    expect(segments[0]?.memberViewIds).toEqual(['a', 'b'])
  })

  it('reorders segments and keeps order in sync', () => {
    const next = reorderTrackSegment([segment('s1', ['a']), segment('s2', ['b'], 1)], 's2', -1)
    expect(next.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(next.map((s) => s.order)).toEqual([0, 1])
  })

  it('toggles collapse without losing members', () => {
    const next = toggleTrackSegmentCollapsed([segment('s1', ['a', 'b'])], 's1')
    expect(next[0]?.collapsed).toBe(true)
    expect(next[0]?.memberViewIds).toEqual(['a', 'b'])
  })

  it('splits selected members into a new segment', () => {
    const next = splitTrackSegment([segment('s1', ['a', 'b', 'c'])], 's1', ['b'], 's1b')
    expect(next).not.toBeNull()
    expect(next![0]?.memberViewIds).toEqual(['a', 'c'])
    expect(next![1]?.memberViewIds).toEqual(['b'])
    expect(next![1]?.order).toBe(1)
  })

  it('inserts a new segment at an explicit Signal Track gap without duplicating existing members', () => {
    const next = insertTrackSegment([segment('s1', ['a']), segment('s2', ['b'], 1)], 1, ['c', 'a'], 's-new', '导入段')
    expect(next.map((item) => item.id)).toEqual(['s1', 's-new', 's2'])
    expect(next[1]?.memberViewIds).toEqual(['c'])
    expect(next.map((item) => item.order)).toEqual([0, 1, 2])
  })

  it('merges two segments with dedupe', () => {
    const next = mergeTrackSegments([segment('s1', ['a', 'b']), segment('s2', ['b', 'c'], 1)], 's2', 's1')
    expect(next![0]?.memberViewIds).toEqual(['a', 'b', 'c'])
    expect(next?.length).toBe(1)
  })

  it('removes a member without deleting the artifact and drops empty segments', () => {
    const next = removeTrackSegmentMember([segment('s1', ['a', 'b'])], 's1', 'a')
    expect(next[0]?.memberViewIds).toEqual(['b'])
    const emptied = removeTrackSegmentMember([segment('s1', ['a'])], 's1', 'a')
    expect(emptied).toHaveLength(0)
  })

  it('adds members with global dedupe and normalizes against available members', () => {
    const next = addTrackSegmentMembers([segment('s1', ['a'])], 's1', ['b', 'a'])
    expect(next[0]?.memberViewIds).toEqual(['a', 'b'])
    const normalized = normalizeTrackSegments([segment('s1', ['a', 'x']), segment('s2', ['a'], 1)], ['a', 'b'])
    expect(normalized[0]?.memberViewIds).toEqual(['a'])
    expect(normalized).toHaveLength(1)
  })

  it('clamps mechanical density to 1-12', () => {
    expect(trackSegmentDensity(segment('s1', []))).toBe(1)
    expect(trackSegmentDensity(segment('s1', Array.from({ length: 40 }, (_, i) => String(i))))).toBe(12)
  })
  it('always renders exact Context members even when saved segment ids are stale or absent', () => {
    const stale = [segment('legacy', ['old-clone'])]
    const covered = ensureTrackSegmentsCoverMembers(stale, ['view-a', 'view-b'])
    expect(covered.flatMap((item) => item.memberViewIds)).toEqual(['view-a', 'view-b'])
    expect(covered[0]?.label).toBe('当前内容')

    const partiallyCovered = ensureTrackSegmentsCoverMembers([segment('s1', ['view-a'])], ['view-a', 'view-b'])
    expect(partiallyCovered.flatMap((item) => item.memberViewIds)).toEqual(['view-a', 'view-b'])
    expect(partiallyCovered.at(-1)?.label).toBe('未编排')
  })

})
