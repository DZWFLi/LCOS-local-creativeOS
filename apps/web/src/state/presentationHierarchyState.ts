import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CanvasNode } from '../model'
import { contractToHierarchy, hierarchyToContract, normalizeHierarchyState, type PresentationHierarchyState } from '../features/presentation/presentationHierarchy'
import { capabilityForRenderer, getPresentationBridge } from './presentationViewState'

const memory = new Map<string, PresentationHierarchyState>()

function keyOf(projectId: string, scopeId: string, presentation: string) {
  return `presentation-hierarchy:${projectId}:${scopeId}:${presentation}`
}

/**
 * Session-level Presentation hierarchy shared by Outline and Mind Map.
 * It intentionally does not use localStorage: hierarchy/order is product state, not a disposable UI preference.
 * Phase B: memory remains the working copy, but hierarchy is mirrored into the
 * persistent PresentationView (debounced) and restored once the bridge is ready.
 */
export function usePresentationHierarchyState(projectId: string, scopeId: string, presentation: string, seed: PresentationHierarchyState, nodes: readonly CanvasNode[]) {
  const key = useMemo(() => keyOf(projectId, scopeId, presentation), [presentation, projectId, scopeId])
  const [state, setStateValue] = useState<PresentationHierarchyState>(() => normalizeHierarchyState(memory.get(key) ?? seed, nodes, seed))

  useEffect(() => {
    let applied = false
    const check = (): boolean => {
      const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(presentation))
      if (!bridge?.ready || bridge.state === null || applied) return false
      applied = true
      const restored = contractToHierarchy(bridge.state.hierarchy, memory.get(key) ?? seed)
      setStateValue(normalizeHierarchyState(restored, nodes, seed))
      return true
    }
    if (check()) return
    const timer = window.setInterval(() => { if (check()) window.clearInterval(timer) }, 200)
    const timeout = window.setTimeout(() => window.clearInterval(timer), 4000)
    return () => { window.clearInterval(timer); window.clearTimeout(timeout) }
  }, [key, nodes, presentation, projectId, scopeId, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStateValue(normalizeHierarchyState(memory.get(key) ?? seed, nodes, seed))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStateValue((current) => {
      const next = normalizeHierarchyState(current, nodes, seed)
      memory.set(key, next)
      return next
    })
  }, [key, nodes, seed])

  const setState = useCallback((next: PresentationHierarchyState | ((current: PresentationHierarchyState) => PresentationHierarchyState)) => {
    setStateValue((current) => {
      const value = normalizeHierarchyState(typeof next === 'function' ? next(current) : next, nodes, seed)
      memory.set(key, value)
      return value
    })
    const latest = memory.get(key)
    if (latest !== undefined) {
      const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(presentation))
      if (bridge?.ready) {
        bridge.patch((persisted) => ({ ...persisted, hierarchy: hierarchyToContract(latest) }))
        bridge.flushSoon()
      }
    }
  }, [key, nodes, presentation, projectId, scopeId, seed])

  return [state, setState] as const
}
