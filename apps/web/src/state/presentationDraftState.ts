import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasEdge } from '../model'
import type { SpatialPoint } from '../features/spatial/spatialTypes'
import type { PresentationStateV0 } from '@local-creative-os/contracts'
import { capabilityForRenderer, getPresentationBridge } from './presentationViewState'

const positionMemory = new Map<string, Record<string, SpatialPoint>>()
const hiddenMemory = new Map<string, string[]>()
const edgeMemory = new Map<string, CanvasEdge[]>()
const pinnedMemory = new Map<string, string[]>()

function keyOf(projectId: string, scopeId: string, renderer: string) {
  return `presentation-draft:${projectId}:${scopeId}:${renderer}`
}

/**
 * Temporary UI-only Presentation repository with Phase B persistence mirror.
 * Memory remains the local source of truth while a PresentationView exists;
 * writes are mirrored into the active persistent view (debounced by the bridge).
 * Positions / edges / pinned persist; edge-cut hidden ids stay memory-only.
 */

function mirror(projectId: string, scopeId: string, renderer: string, mutator: (state: PresentationStateV0) => PresentationStateV0): void {
  const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(renderer))
  if (bridge?.ready) {
    bridge.patch(mutator)
    bridge.flushSoon()
  }
}

/** Apply persisted state once after the bridge becomes ready (bounded poll). */
function usePersistedMirror(projectId: string, scopeId: string, renderer: string, apply: (state: PresentationStateV0) => void): void {
  const appliedRef = useRef(false)
  useEffect(() => {
    appliedRef.current = false
    const check = (): boolean => {
      const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(renderer))
      if (!bridge?.ready || bridge.state === null || appliedRef.current) return false
      appliedRef.current = true
      apply(bridge.state)
      return true
    }
    if (check()) return
    const timer = window.setInterval(() => { if (check()) window.clearInterval(timer) }, 200)
    const timeout = window.setTimeout(() => window.clearInterval(timer), 4000)
    return () => { window.clearInterval(timer); window.clearTimeout(timeout) }
  }, [projectId, scopeId, renderer]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function usePresentationDraftPositions(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => keyOf(projectId, scopeId, renderer), [projectId, renderer, scopeId])
  const [positions, setPositionsState] = useState<Record<string, SpatialPoint>>(() => positionMemory.get(key) ?? {})
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    if (Object.keys(persisted.positions).length > 0) setPositionsState(persisted.positions)
  })

  useEffect(() => {
    setPositionsState(positionMemory.get(key) ?? {})
  }, [key])

  const setPositions = useCallback((next: Record<string, SpatialPoint> | ((current: Record<string, SpatialPoint>) => Record<string, SpatialPoint>)) => {
    setPositionsState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      positionMemory.set(key, value)
      return value
    })
    const latest = positionMemory.get(key)
    if (latest !== undefined) mirror(projectId, scopeId, renderer, (state) => ({ ...state, positions: latest }))
  }, [key, projectId, renderer, scopeId])

  return [positions, setPositions] as const
}

/** Workflow membership edits are still draft-only in Phase B, but no longer disappear on renderer remount. */
export function usePresentationDraftHiddenIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:hidden`, [projectId, renderer, scopeId])
  const [hiddenIds, setHiddenState] = useState<string[]>(() => hiddenMemory.get(key) ?? [])
  useEffect(() => { setHiddenState(hiddenMemory.get(key) ?? []) }, [key])
  // Edge-cut hidden ids are NOT persisted: the PresentationView contract has
  // hiddenViewIds (view-level), not edge-level cuts.
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
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    if (persisted.presentationEdges.length > 0) {
      setEdgeState(persisted.presentationEdges.map((entry) => ({ id: entry.id, from: entry.fromViewId, to: entry.toViewId, kind: 'reference' as const })))
    }
  })
  useEffect(() => { setEdgeState(edgeMemory.get(key) ?? [...fallback]) }, [key]) // fallback is reconciled by the renderer
  const setEdges = useCallback((next: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => {
    setEdgeState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      edgeMemory.set(key, value)
      return value
    })
    const latest = edgeMemory.get(key)
    if (latest !== undefined) {
      mirror(projectId, scopeId, renderer, (state) => ({
        ...state,
        presentationEdges: latest
          .filter((edge) => edge.id.startsWith('context-temp:'))
          .map((edge) => ({ id: edge.id, fromViewId: edge.from, toViewId: edge.to })),
      }))
    }
  }, [key, projectId, renderer, scopeId])
  return [edges, setEdges] as const
}


/** User-dragged Presentation nodes become explicit manual anchors for future layout previews. */
export function usePresentationDraftPinnedIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:pinned`, [projectId, renderer, scopeId])
  const [pinnedIds, setPinnedState] = useState<string[]>(() => pinnedMemory.get(key) ?? [])
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    if (persisted.pinnedViewIds.length > 0) setPinnedState(persisted.pinnedViewIds)
  })
  useEffect(() => { setPinnedState(pinnedMemory.get(key) ?? []) }, [key])
  const setPinnedIds = useCallback((next: string[] | ((current: string[]) => string[])) => {
    setPinnedState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      pinnedMemory.set(key, value)
      return value
    })
    const latest = pinnedMemory.get(key)
    if (latest !== undefined) mirror(projectId, scopeId, renderer, (state) => ({ ...state, pinnedViewIds: latest }))
  }, [key, projectId, renderer, scopeId])
  return [pinnedIds, setPinnedIds] as const
}
