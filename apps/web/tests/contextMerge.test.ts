import { describe, expect, it } from 'vitest'
import { proposeContextMergeCandidate, type ContextViewSummary } from '../src/features/context/contextMerge'

const view = (id: string, memberViewIds: readonly string[]): ContextViewSummary => ({ id, title: id, memberViewIds })

describe('Phase 3 Slice 2 — Context merge proposal', () => {
  it('computes only the intended additions from A into B', () => {
    const proposal = proposeContextMergeCandidate(view('a', ['v1', 'v2', 'v3']), view('b', ['v2', 'v4']))
    expect(proposal).toEqual({
      type: 'context-membership-proposal',
      targetContextId: 'b',
      sourceContextId: 'a',
      additions: ['v1', 'v3'],
      entityAdditions: [],
    })
  })

  it('rejects self-merge', () => {
    expect(proposeContextMergeCandidate(view('a', ['v1']), view('a', ['v1']))).toBeNull()
  })

  it('produces an empty-additions proposal when A is already a subset of B', () => {
    const proposal = proposeContextMergeCandidate(view('a', ['v1']), view('b', ['v1', 'v2']))
    expect(proposal?.additions).toEqual([])
    expect(proposal?.targetContextId).toBe('b')
  })


  it('includes aggregate Project entities without expanding their children', () => {
    const source: ContextViewSummary = { id: 'a', title: 'a', memberViewIds: [], memberEntityNodeIds: ['workspace:ws-1', 'scope:collection-1'] }
    const target: ContextViewSummary = { id: 'b', title: 'b', memberViewIds: [], memberEntityNodeIds: ['workspace:ws-1'] }
    const proposal = proposeContextMergeCandidate(source, target)
    expect(proposal?.additions).toEqual([])
    expect(proposal?.entityAdditions).toEqual(['scope:collection-1'])
  })

  it('dedupes by content identity across different view ids (same artifact)', () => {
    const source: ContextViewSummary = { id: 'a', title: 'a', memberViewIds: ['view-a1', 'view-a2', 'view-a3'], memberContentKeys: ['art-1', 'art-2', 'art-3'] }
    const target: ContextViewSummary = { id: 'b', title: 'b', memberViewIds: ['view-b1', 'view-b2'], memberContentKeys: ['art-1', 'art-9'] }
    const proposal = proposeContextMergeCandidate(source, target)
    expect(proposal?.additions).toEqual(['view-a2', 'view-a3'])
  })
})
