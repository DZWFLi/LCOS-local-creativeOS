import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkflowOperatorV0 } from '@local-creative-os/contracts'
import { getPresentationBridge, presentationBridgeKey, subscribePresentationBridge } from './presentationViewState'

const memory = new Map<string, Record<string, WorkflowOperatorV0>>()

function keyOf(projectId: string, scopeId: string) {
  return `presentation-operators:${projectId}:${scopeId}`
}

/**
 * Phase 4 §7.1：Workflow operator 元数据（Presentation-only）。
 * 存于 workflow capability presentation state.workflowOperators，经既有 bridge CAS 持久化。
 */
export function useWorkflowOperatorsState(projectId: string, scopeId: string) {
  const operatorKey = useMemo(() => keyOf(projectId, scopeId), [projectId, scopeId])
  const [operators, setOperatorsValue] = useState<Record<string, WorkflowOperatorV0>>(() => memory.get(operatorKey) ?? {})

  useEffect(() => {
    setOperatorsValue(memory.get(operatorKey) ?? {})
    const bridgeKey = presentationBridgeKey(projectId, scopeId, 'workflow')
    let unsubscribeBridge: (() => void) | undefined

    const bindAndApply = (): void => {
      unsubscribeBridge?.()
      const bridge = getPresentationBridge(projectId, scopeId, 'workflow')
      if (bridge === undefined) return
      const applyCurrent = (): void => {
        const current = getPresentationBridge(projectId, scopeId, 'workflow')
        if (current?.state === null || current?.state === undefined) return
        if (current.state.workflowOperators !== undefined) {
          memory.set(operatorKey, current.state.workflowOperators)
          setOperatorsValue(current.state.workflowOperators)
        }
      }
      unsubscribeBridge = bridge.subscribe(applyCurrent)
      applyCurrent()
    }

    bindAndApply()
    const unsubscribeRegistry = subscribePresentationBridge(bridgeKey, bindAndApply)
    return () => { unsubscribeBridge?.(); unsubscribeRegistry() }
  }, [operatorKey, projectId, scopeId])

  const setOperators = useCallback((next: Record<string, WorkflowOperatorV0>) => {
    const bridge = getPresentationBridge(projectId, scopeId, 'workflow')
    if (!bridge?.ready) return
    bridge.patch((persisted) => ({ ...persisted, workflowOperators: next }))
    bridge.flushSoon()
    memory.set(operatorKey, next)
    setOperatorsValue(next)
  }, [operatorKey, projectId, scopeId])

  return [operators, setOperators] as const
}
