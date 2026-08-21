import { describe, expect, it } from 'vitest'

import { contractToHierarchy, hierarchyToContract, type PresentationHierarchyState } from '../src/features/presentation/presentationHierarchy'

const state: PresentationHierarchyState = {
  orderIds: ['root', 'child-a', 'grand', 'child-b'],
  depthById: { root: 0, 'child-a': 1, grand: 2, 'child-b': 1 },
  collapsedIds: ['root'],
  version: 5,
}

describe('Hierarchy persistence roundtrip (Phase B)', () => {
  it('flattens UI hierarchy into the contract shape', () => {
    const contract = hierarchyToContract(state)
    expect(contract.parentByViewId).toEqual({
      root: null,
      'child-a': 'root',
      'child-b': 'root',
      grand: 'child-a',
    })
    expect(contract.orderByParent['']).toEqual(['root'])
    expect(contract.orderByParent['root']).toEqual(['child-a', 'child-b'])
    expect(contract.orderByParent['child-a']).toEqual(['grand'])
  })

  it('restores order and depth while preserving collapse state', () => {
    const restored = contractToHierarchy(hierarchyToContract(state), state)
    expect(restored.orderIds).toEqual(state.orderIds)
    expect(restored.depthById).toEqual(state.depthById)
    expect(restored.collapsedIds).toEqual(['root'])
  })
})
