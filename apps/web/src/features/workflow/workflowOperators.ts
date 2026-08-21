import type { WorkflowOperatorKindV0, WorkflowOperatorV0 } from '@local-creative-os/contracts'

/**
 * Phase 4 §7.1-7.3：Workflow operator（Presentation-only authoring metadata）。
 * 没有 serial operator：串行就是一条边。
 */

export type WorkflowOperators = Record<string, WorkflowOperatorV0>

const defaultBranches = (seed: string) => [
  { id: `${seed}-a`, label: '分支 A' },
  { id: `${seed}-b`, label: '分支 B' },
]

export function setWorkflowOperator(
  operators: WorkflowOperators,
  viewId: string,
  operator: WorkflowOperatorV0,
): WorkflowOperators {
  const needsBranches = (operator.kind === 'condition' || operator.kind === 'parallel-split') && operator.branches === undefined
  return { ...operators, [viewId]: needsBranches ? { ...operator, branches: defaultBranches(viewId) } : operator }
}

export function clearWorkflowOperator(operators: WorkflowOperators, viewId: string): WorkflowOperators {
  const next = { ...operators }
  delete next[viewId]
  return next
}

export function addConditionBranch(
  operators: WorkflowOperators,
  viewId: string,
  branchId: string,
): WorkflowOperators {
  const operator = operators[viewId]
  if (operator === undefined || (operator.kind !== 'condition' && operator.kind !== 'parallel-split')) return operators
  if (operator.branches === undefined) return { ...operators, [viewId]: { ...operator, branches: defaultBranches(branchId) } }
  const branches = operator.branches
  return { ...operators, [viewId]: { ...operator, branches: [...branches, { id: branchId, label: `分支 ${branches.length + 1}` }] } }
}

export function removeConditionBranch(
  operators: WorkflowOperators,
  viewId: string,
  branchId: string,
): WorkflowOperators {
  const operator = operators[viewId]
  if (operator?.branches === undefined) return operators
  if (operator.branches.length <= 2) return operators
  return { ...operators, [viewId]: { ...operator, branches: operator.branches.filter((branch) => branch.id !== branchId) } }
}

export function updateConditionBranch(
  operators: WorkflowOperators,
  viewId: string,
  branchId: string,
  patch: { readonly label?: string; readonly predicateText?: string },
): WorkflowOperators {
  const operator = operators[viewId]
  if (operator?.branches === undefined) return operators
  return {
    ...operators,
    [viewId]: {
      ...operator,
      branches: operator.branches.map((branch) => branch.id === branchId ? { ...branch, ...patch } : branch),
    },
  }
}

export interface PortCounts {
  readonly inputs: number
  readonly outputs: number
}

export function portCounts(operator: WorkflowOperatorV0 | undefined): PortCounts {
  if (operator === undefined) return { inputs: 1, outputs: 1 }
  if (operator.kind === 'condition') return { inputs: 1, outputs: Math.max(2, operator.branches?.length ?? 2) }
  if (operator.kind === 'parallel-split') return { inputs: 1, outputs: Math.max(2, operator.branches?.length ?? 2) }
  if (operator.kind === 'parallel-join') return { inputs: Math.max(2, operator.branches?.length ?? 2), outputs: 1 }
  if (operator.kind === 'reference') return { inputs: 1, outputs: 0 }
  return { inputs: 1, outputs: 1 }
}

export function operatorKinds(): WorkflowOperatorKindV0[] {
  return ['condition', 'parallel-split', 'parallel-join', 'reference']
}
