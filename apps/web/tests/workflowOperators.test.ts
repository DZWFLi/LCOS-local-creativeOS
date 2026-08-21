import { describe, expect, it } from 'vitest'
import {
  addConditionBranch,
  clearWorkflowOperator,
  operatorKinds,
  portCounts,
  removeConditionBranch,
  setWorkflowOperator,
  updateConditionBranch,
} from '../src/features/workflow/workflowOperators'

describe('Phase 4 Slice 1 — Workflow operators', () => {
  it('exposes exactly the four operator kinds without a serial operator', () => {
    expect(operatorKinds()).toEqual(['condition', 'parallel-split', 'parallel-join', 'reference'])
  })

  it('gives normal nodes 1-in/1-out and reference nodes a read-only input', () => {
    expect(portCounts(undefined)).toEqual({ inputs: 1, outputs: 1 })
    expect(portCounts({ kind: 'reference' })).toEqual({ inputs: 1, outputs: 0 })
  })

  it('condition and parallel-split expose 2+ named output branches', () => {
    expect(portCounts({ kind: 'condition' }).outputs).toBeGreaterThanOrEqual(2)
    expect(portCounts({ kind: 'parallel-split', branches: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] }).outputs).toBe(3)
    expect(portCounts({ kind: 'parallel-join', branches: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] }).inputs).toBe(3)
  })

  it('adds/removes branches with a 2-branch floor and updates predicate text', () => {
    let ops = setWorkflowOperator({}, 'n1', { kind: 'condition' })
    expect(ops.n1?.branches?.length).toBe(2)
    ops = addConditionBranch(ops, 'n1', 'c1')
    expect(ops.n1?.branches?.length).toBe(3)
    ops = updateConditionBranch(ops, 'n1', 'c1', { label: '通过', predicateText: '当用户确认时' })
    expect(ops.n1?.branches?.find((branch) => branch.id === 'c1')?.predicateText).toBe('当用户确认时')
    ops = removeConditionBranch(ops, 'n1', 'c1')
    expect(ops.n1?.branches?.length).toBe(2)
    ops = clearWorkflowOperator(ops, 'n1')
    expect(ops.n1).toBeUndefined()
  })
})
