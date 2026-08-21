import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkflowActionEdgeV0, WorkflowActionV0 } from '@local-creative-os/contracts'
import { getPresentationBridge, presentationBridgeKey, subscribePresentationBridge } from './presentationViewState'

export interface WorkflowActionStateV0 {
  readonly actions: readonly WorkflowActionV0[]
  readonly edges: readonly WorkflowActionEdgeV0[]
}

const memory = new Map<string, WorkflowActionStateV0>()
const empty: WorkflowActionStateV0 = { actions: [], edges: [] }

function keyOf(projectId: string, scopeId: string) {
  return `presentation-workflow-actions:${projectId}:${scopeId}`
}

/**
 * Durable Workflow action skeleton. It belongs to Presentation, not Project
 * business truth. attachedViewIds always point at the existing Project Views.
 */
export function useWorkflowActionState(projectId: string, scopeId: string) {
  const stateKey = useMemo(() => keyOf(projectId, scopeId), [projectId, scopeId])
  const [state, setStateValue] = useState<WorkflowActionStateV0>(() => memory.get(stateKey) ?? empty)

  useEffect(() => {
    setStateValue(memory.get(stateKey) ?? empty)
    const bridgeKey = presentationBridgeKey(projectId, scopeId, 'workflow')
    let unsubscribeBridge: (() => void) | undefined
    const bind = () => {
      unsubscribeBridge?.()
      const bridge = getPresentationBridge(projectId, scopeId, 'workflow')
      if (!bridge) return
      const apply = () => {
        const current = getPresentationBridge(projectId, scopeId, 'workflow')
        if (!current?.state) return
        const next = {
          actions: current.state.workflowActions ?? [],
          edges: current.state.workflowActionEdges ?? [],
        } satisfies WorkflowActionStateV0
        memory.set(stateKey, next)
        setStateValue(next)
      }
      unsubscribeBridge = bridge.subscribe(apply)
      apply()
    }
    bind()
    const unsubscribeRegistry = subscribePresentationBridge(bridgeKey, bind)
    return () => { unsubscribeBridge?.(); unsubscribeRegistry() }
  }, [projectId, scopeId, stateKey])

  const setState = useCallback((next: WorkflowActionStateV0 | ((current: WorkflowActionStateV0) => WorkflowActionStateV0)) => {
    const bridge = getPresentationBridge(projectId, scopeId, 'workflow')
    if (!bridge?.ready) return false
    const current = memory.get(stateKey) ?? state
    const value = typeof next === 'function' ? next(current) : next
    bridge.patch((persisted) => ({
      ...persisted,
      workflowActions: [...value.actions],
      workflowActionEdges: [...value.edges],
    }))
    bridge.flushSoon()
    memory.set(stateKey, value)
    setStateValue(value)
    return true
  }, [projectId, scopeId, state, stateKey])

  return [state, setState] as const
}
