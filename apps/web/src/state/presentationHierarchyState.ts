import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CanvasNode } from '../model'
import { contractToHierarchy, hierarchyToContract, normalizeHierarchyState, type PresentationHierarchyState } from '../features/presentation/presentationHierarchy'
import { capabilityForRenderer, getPresentationBridge, presentationBridgeKey, subscribePresentationBridge } from './presentationViewState'

const memory = new Map<string, PresentationHierarchyState>()

function keyOf(projectId: string, scopeId: string, presentation: string) {
  return `presentation-hierarchy:${projectId}:${scopeId}:${presentation}`
}

/**
 * HU-3: Session-level optimistic hierarchy（Outline / Mind Map 共享）。
 * Core PresentationView 是 committed truth；memory 只是等 flush 的乐观层；
 * 恢复走 bridge.subscribe 事件驱动（无 200ms 轮询）。
 * does not use localStorage：层级真相只在 Core PresentationView，不在浏览器持久层。
 */
export function usePresentationHierarchyState(projectId: string, scopeId: string, presentation: string, seed: PresentationHierarchyState, nodes: readonly CanvasNode[]) {
  const hierarchyKey = useMemo(() => keyOf(projectId, scopeId, presentation), [presentation, projectId, scopeId])
  const [state, setStateValue] = useState<PresentationHierarchyState>(() => normalizeHierarchyState(memory.get(hierarchyKey) ?? seed, nodes, seed))

  useEffect(() => {
    // On identity change show the correct renderer-local optimistic seed first;
    // the committed Core state below then wins deterministically when available.
    setStateValue(normalizeHierarchyState(memory.get(hierarchyKey) ?? seed, nodes, seed))
    const capability = capabilityForRenderer(presentation)
    const bridgeKey = presentationBridgeKey(projectId, scopeId, capability)
    let unsubscribeBridge: (() => void) | undefined

    const bindAndApply = (): void => {
      unsubscribeBridge?.()
      const bridge = getPresentationBridge(projectId, scopeId, capability)
      if (bridge === undefined) return
      const applyCurrent = (): void => {
        const current = getPresentationBridge(projectId, scopeId, capability)
        if (current?.state === null || current?.state === undefined) return
        const restored = contractToHierarchy(current.state.hierarchy, memory.get(hierarchyKey) ?? seed)
        const normalized = normalizeHierarchyState(restored, nodes, seed)
        memory.set(hierarchyKey, normalized)
        setStateValue(normalized)
      }
      unsubscribeBridge = bridge.subscribe(applyCurrent)
      applyCurrent()
    }

    bindAndApply()
    const unsubscribeRegistry = subscribePresentationBridge(bridgeKey, bindAndApply)
    return () => { unsubscribeBridge?.(); unsubscribeRegistry() }
  }, [hierarchyKey, nodes, presentation, projectId, scopeId, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStateValue((current) => {
      const next = normalizeHierarchyState(current, nodes, seed)
      memory.set(hierarchyKey, next)
      return next
    })
  }, [hierarchyKey, nodes, seed])

  const setState = useCallback((next: PresentationHierarchyState | ((current: PresentationHierarchyState) => PresentationHierarchyState)) => {
    const value = normalizeHierarchyState(typeof next === 'function' ? next(memory.get(hierarchyKey) ?? seed) : next, nodes, seed)
    const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(presentation))
    if (!bridge?.ready) return
    bridge.patch((persisted) => ({ ...persisted, hierarchy: hierarchyToContract(value) }))
    bridge.flushSoon()
    memory.set(hierarchyKey, value)
    setStateValue(value)
  }, [hierarchyKey, nodes, presentation, projectId, scopeId, seed])

  return [state, setState] as const
}
