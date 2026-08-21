import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(new URL('../src/features/surfaces/WorkflowSurface.tsx', import.meta.url), 'utf8')
const operatorState = readFileSync(new URL('../src/state/presentationOperatorState.ts', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../../../packages/contracts/src/presentations.ts', import.meta.url), 'utf8')

describe('Phase 4 Slice 1 — Workflow operator contract', () => {
  it('persists operators through the workflow presentation state', () => {
    expect(contracts).toContain('workflowOperators?: Record<string, WorkflowOperatorV0>')
    expect(operatorState).toContain('state.workflowOperators')
    expect(operatorState).toContain("getPresentationBridge(projectId, scopeId, 'workflow')")
  })

  it('removes fake operator authoring and edits condition/dependency semantics on relations', () => {
    expect(workflow).not.toContain('lcos-workflow-operator-palette')
    expect(workflow).not.toContain('lcos-workflow-operator-inspector')
    expect(workflow).not.toContain('operatorKinds()')
    expect(workflow).toContain('lcos-workflow-edge-inspector')
    expect(workflow).toContain('updateSelectedEdgeLabel')
  })

  it('renders ports only on Workflow actions and persists Step-to-Step branch targets', () => {
    expect(workflow).toContain('data-workflow-action-input={action.id}')
    expect(workflow).toContain('beginLink(event, action.id)')
    expect(workflow).toContain('fromActionId: link.from')
    expect(workflow).toContain('toActionId: to')
    expect(workflow).not.toContain('data-workflow-input={node.id}')
  })

  it('carries a run overlay projection without making run nodes canonical', () => {
    expect(workflow).toContain('runOverlay')
    expect(workflow).toContain('run-active')
    expect(workflow).toContain('run-failed')
  })
})
