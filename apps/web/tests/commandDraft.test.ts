import { describe, expect, it } from 'vitest'
import { explicitExecutionReferenceIds, mergeExecutionContextIds } from '../src/features/execution/commandDraft'

describe('selection/reference execution semantics', () => {
  it('keeps ordinary Selection out of the explicit Reference set', () => {
    expect(explicitExecutionReferenceIds(['ref-a', 'ref-a', 'target', 'ref-b'], 'target')).toEqual(['ref-a', 'ref-b'])
  })

  it('keeps Selection as foreground execution context without relabeling it as Reference', () => {
    expect(mergeExecutionContextIds(['selected-a', 'target'], ['ref-a', 'selected-a'], 'target')).toEqual(['selected-a', 'ref-a'])
  })
})
