import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CanvasNode } from '../model'
import { normalizeHierarchyState, type PresentationHierarchyState } from '../features/presentation/presentationHierarchy'

const memory = new Map<string, PresentationHierarchyState>()

function keyOf(projectId: string, scopeId: string, presentation: string) {
  return `presentation-hierarchy:${projectId}:${scopeId}:${presentation}`
}

/**
 * Session-level Presentation hierarchy shared by Outline and Mind Map.
 * It intentionally does not use localStorage: hierarchy/order is product state, not a disposable UI preference.
 * Replace this repository with Local Core PresentationView persistence once that contract is approved.
 */
export function usePresentationHierarchyState(projectId: string, scopeId: string, presentation: string, seed: PresentationHierarchyState, nodes: readonly CanvasNode[]) {
  const key = useMemo(() => keyOf(projectId, scopeId, presentation), [presentation, projectId, scopeId])
  const [state, setStateValue] = useState<PresentationHierarchyState>(() => normalizeHierarchyState(memory.get(key) ?? seed, nodes, seed))

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
  }, [key, nodes, seed])

  return [state, setState] as const
}
