import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CanvasEdge } from '../model'
import type { SpatialPoint } from '../features/spatial/spatialTypes'

const positionMemory = new Map<string, Record<string, SpatialPoint>>()
const hiddenMemory = new Map<string, string[]>()
const edgeMemory = new Map<string, CanvasEdge[]>()
const pinnedMemory = new Map<string, string[]>()

function keyOf(projectId: string, scopeId: string, renderer: string) {
  return `presentation-draft:${projectId}:${scopeId}:${renderer}`
}

/**
 * Temporary UI-only Presentation repository.
 * It intentionally stays in memory until the Local Core PresentationView contract is approved.
 * Nothing here is Project Truth and nothing is promoted from Selection implicitly.
 */
export function usePresentationDraftPositions(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => keyOf(projectId, scopeId, renderer), [projectId, renderer, scopeId])
  const [positions, setPositionsState] = useState<Record<string, SpatialPoint>>(() => positionMemory.get(key) ?? {})

  useEffect(() => {
    setPositionsState(positionMemory.get(key) ?? {})
  }, [key])

  const setPositions = useCallback((next: Record<string, SpatialPoint> | ((current: Record<string, SpatialPoint>) => Record<string, SpatialPoint>)) => {
    setPositionsState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      positionMemory.set(key, value)
      return value
    })
  }, [key])

  return [positions, setPositions] as const
}

/** Workflow membership edits are still draft-only in Phase B, but no longer disappear on renderer remount. */
export function usePresentationDraftHiddenIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:hidden`, [projectId, renderer, scopeId])
  const [hiddenIds, setHiddenState] = useState<string[]>(() => hiddenMemory.get(key) ?? [])
  useEffect(() => { setHiddenState(hiddenMemory.get(key) ?? []) }, [key])
  const setHiddenIds = useCallback((next: string[] | ((current: string[]) => string[])) => {
    setHiddenState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      hiddenMemory.set(key, value)
      return value
    })
  }, [key])
  return [hiddenIds, setHiddenIds] as const
}

/** Presentation-only edges live beside draft positions until a versioned Local Core contract exists. */
export function usePresentationDraftEdges(projectId: string, scopeId: string, renderer: string, fallback: readonly CanvasEdge[]) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:edges`, [projectId, renderer, scopeId])
  const [edges, setEdgeState] = useState<CanvasEdge[]>(() => edgeMemory.get(key) ?? [...fallback])
  useEffect(() => { setEdgeState(edgeMemory.get(key) ?? [...fallback]) }, [key]) // fallback is reconciled by the renderer
  const setEdges = useCallback((next: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => {
    setEdgeState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      edgeMemory.set(key, value)
      return value
    })
  }, [key])
  return [edges, setEdges] as const
}


/** User-dragged Presentation nodes become explicit manual anchors for future layout previews. */
export function usePresentationDraftPinnedIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:pinned`, [projectId, renderer, scopeId])
  const [pinnedIds, setPinnedState] = useState<string[]>(() => pinnedMemory.get(key) ?? [])
  useEffect(() => { setPinnedState(pinnedMemory.get(key) ?? []) }, [key])
  const setPinnedIds = useCallback((next: string[] | ((current: string[]) => string[])) => {
    setPinnedState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      pinnedMemory.set(key, value)
      return value
    })
  }, [key])
  return [pinnedIds, setPinnedIds] as const
}
