import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasEdge } from '../model'
import type { SpatialPoint } from '../features/spatial/spatialTypes'
import type { PresentationStateV0, SurfaceElementV0 } from '@local-creative-os/contracts'
import { capabilityForRenderer, getPresentationBridge, presentationBridgeKey, subscribePresentationBridge } from './presentationViewState'

const positionMemory = new Map<string, Record<string, SpatialPoint>>()
const hiddenMemory = new Map<string, string[]>()
const edgeMemory = new Map<string, CanvasEdge[]>()
const pinnedMemory = new Map<string, string[]>()
const surfaceElementMemory = new Map<string, SurfaceElementV0[]>()

/**
 * HU-3B §10 正式契约：presentationEdges 只存“用户/Agent 显式建立的
 * Presentation-only 边”（以 scope='presentation' 为准，兼容既有 context-temp:/presentation: id）。
 * Canonical relations 由渲染器从关系数据派生，绝不混入 presentationEdges。
 */
export const isPresentationCreatedEdge = (edge: CanvasEdge): boolean => edge.scope === 'presentation' || edge.id.startsWith('context-temp:') || edge.id.startsWith('presentation:')

function keyOf(projectId: string, scopeId: string, renderer: string) {
  return `presentation-draft:${projectId}:${scopeId}:${renderer}`
}

/**
 * HU-3: Memory = optimistic working copy（等 flush 的本地 intent），
 * Core PresentationView = committed durable truth。
 * 写路径经 bridge.patch → debounced CAS → Core；读取经 bridge.subscribe 事件驱动（无轮询）。
 * Positions / edges / pinned persist；edge-cut hidden ids 仅本会话乐观层（契约待 HU-3B 明确）。
 */

function mirror(projectId: string, scopeId: string, renderer: string, mutator: (state: PresentationStateV0) => PresentationStateV0): boolean {
  const bridge = getPresentationBridge(projectId, scopeId, capabilityForRenderer(renderer))
  if (!bridge?.ready) return false
  bridge.patch(mutator)
  bridge.flushSoon()
  return true
}

/** Structure/Evolution/Graph geometry is derived; the default Context work scene owns durable Presentation positions. */
const persistsPositions = (renderer: string): boolean => renderer === 'context-space' || !renderer.startsWith('context-')

/** Apply persisted state once after the bridge becomes ready（事件驱动：bridge.subscribe，无轮询）。 */
function usePersistedMirror(projectId: string, scopeId: string, renderer: string, apply: (state: PresentationStateV0) => void): void {
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    const capability = capabilityForRenderer(renderer)
    const bridgeKey = presentationBridgeKey(projectId, scopeId, capability)
    let unsubscribeBridge: (() => void) | undefined

    const bindAndApply = (): void => {
      unsubscribeBridge?.()
      const bridge = getPresentationBridge(projectId, scopeId, capability)
      if (bridge === undefined) return
      const applyCurrent = (): void => {
        const current = getPresentationBridge(projectId, scopeId, capability)
        if (current?.state !== null && current?.state !== undefined) applyRef.current(current.state)
      }
      unsubscribeBridge = bridge.subscribe(applyCurrent)
      applyCurrent()
    }

    bindAndApply()
    const unsubscribeRegistry = subscribePresentationBridge(bridgeKey, bindAndApply)
    return () => { unsubscribeBridge?.(); unsubscribeRegistry() }
  }, [projectId, scopeId, renderer])
}

export function usePresentationDraftPositions(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => keyOf(projectId, scopeId, renderer), [projectId, renderer, scopeId])
  const persistent = persistsPositions(renderer)
  const [positions, setPositionsState] = useState<Record<string, SpatialPoint>>(() => positionMemory.get(key) ?? {})
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    if (!persistent) return
    // Core wins even when committed positions are empty.
    positionMemory.set(key, persisted.positions)
    setPositionsState(persisted.positions)
  })

  useEffect(() => {
    setPositionsState(positionMemory.get(key) ?? {})
  }, [key])

  const setPositions = useCallback((next: Record<string, SpatialPoint> | ((current: Record<string, SpatialPoint>) => Record<string, SpatialPoint>)) => {
    const current = positionMemory.get(key) ?? {}
    const value = typeof next === 'function' ? next(current) : next
    if (persistent && !mirror(projectId, scopeId, renderer, (state) => ({ ...state, positions: value }))) return
    // Derived Context lenses stay renderer-transient; persistent renderers only
    // update RAM after Core accepted the intent into its bridge.
    positionMemory.set(key, value)
    setPositionsState(value)
  }, [key, persistent, projectId, renderer, scopeId])

  return [positions, setPositions] as const
}

/** Workflow membership edits are still draft-only in Phase B, but no longer disappear on renderer remount. */
export function usePresentationDraftHiddenIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:hidden`, [projectId, renderer, scopeId])
  const [hiddenIds, setHiddenState] = useState<string[]>(() => hiddenMemory.get(key) ?? [])
  useEffect(() => { setHiddenState(hiddenMemory.get(key) ?? []) }, [key])
  // HU-3B §11 契约（方案 A）：edge-cut hidden ids 是 renderer-transient——
  // 会话级渲染层状态，不持久、不 undo；PresentationView 只定义 view-level
  // hiddenViewIds，不做 edge-level cut 字段。重开/换会话后恢复 canonical 全边。
  const setHiddenIds = useCallback((next: string[] | ((current: string[]) => string[])) => {
    const value = typeof next === 'function' ? next(hiddenMemory.get(key) ?? []) : next
    hiddenMemory.set(key, value)
    setHiddenState(value)
  }, [key])
  return [hiddenIds, setHiddenIds] as const
}

/**
 * Presentation-only edges（scope='presentation'）落 Core presentationEdges；
 * canonical relations 不经过这里。HU-3B §10 契约见 isPresentationCreatedEdge。
 */
export function usePresentationDraftEdges(projectId: string, scopeId: string, renderer: string, fallback: readonly CanvasEdge[]) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:edges`, [projectId, renderer, scopeId])
  const [edges, setEdgeState] = useState<CanvasEdge[]>(() => edgeMemory.get(key) ?? [...fallback])
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    const persistedOnly = persisted.presentationEdges.map((entry) => ({ id: entry.id, from: entry.fromViewId, to: entry.toViewId, kind: 'reference' as const, scope: 'presentation' as const, ...(entry.label ? { label: entry.label } : {}) }))
    const canonicalFallback = fallback.filter((edge) => !isPresentationCreatedEdge(edge))
    const restored = [...canonicalFallback, ...persistedOnly.filter((edge) => !canonicalFallback.some((item) => item.id === edge.id))]
    edgeMemory.set(key, restored)
    setEdgeState(restored)
  })
  useEffect(() => { setEdgeState(edgeMemory.get(key) ?? [...fallback]) }, [key]) // fallback is reconciled by the renderer
  const setEdges = useCallback((next: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => {
    const value = typeof next === 'function' ? next(edgeMemory.get(key) ?? []) : next
    const accepted = mirror(projectId, scopeId, renderer, (state) => ({
      ...state,
      presentationEdges: value
        .filter(isPresentationCreatedEdge)
        .map((edge) => ({ id: edge.id, fromViewId: edge.from, toViewId: edge.to, ...(edge.label ? { label: edge.label } : {}) })),
    }))
    if (!accepted) return
    edgeMemory.set(key, value)
    setEdgeState(value)
  }, [key, projectId, renderer, scopeId])
  return [edges, setEdges] as const
}


/** User-dragged Presentation nodes become explicit manual anchors for future layout previews. */
export function usePresentationDraftPinnedIds(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:pinned`, [projectId, renderer, scopeId])
  const [pinnedIds, setPinnedState] = useState<string[]>(() => pinnedMemory.get(key) ?? [])
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    pinnedMemory.set(key, persisted.pinnedViewIds)
    setPinnedState(persisted.pinnedViewIds)
  })
  useEffect(() => { setPinnedState(pinnedMemory.get(key) ?? []) }, [key])
  const setPinnedIds = useCallback((next: string[] | ((current: string[]) => string[])) => {
    const value = typeof next === 'function' ? next(pinnedMemory.get(key) ?? []) : next
    if (!mirror(projectId, scopeId, renderer, (state) => ({ ...state, pinnedViewIds: value }))) return
    pinnedMemory.set(key, value)
    setPinnedState(value)
  }, [key, projectId, renderer, scopeId])
  return [pinnedIds, setPinnedIds] as const
}


/**
 * Durable trusted Surface Components. They are Presentation-only geometry and
 * identity-only bindings, mirrored through the same Core Presentation bridge.
 */
export function usePresentationSurfaceElements(projectId: string, scopeId: string, renderer: string) {
  const key = useMemo(() => `${keyOf(projectId, scopeId, renderer)}:surface-elements`, [projectId, renderer, scopeId])
  const [elements, setElementState] = useState<SurfaceElementV0[]>(() => surfaceElementMemory.get(key) ?? [])
  usePersistedMirror(projectId, scopeId, renderer, (persisted) => {
    const restored = persisted.surfaceElements ?? []
    surfaceElementMemory.set(key, restored)
    setElementState(restored)
  })
  useEffect(() => { setElementState(surfaceElementMemory.get(key) ?? []) }, [key])
  const setElements = useCallback((next: SurfaceElementV0[] | ((current: SurfaceElementV0[]) => SurfaceElementV0[])) => {
    const current = surfaceElementMemory.get(key) ?? []
    const value = typeof next === 'function' ? next(current) : next
    if (!mirror(projectId, scopeId, renderer, (state) => ({ ...state, surfaceElements: value }))) return false
    surfaceElementMemory.set(key, value)
    setElementState(value)
    return true
  }, [key, projectId, renderer, scopeId])
  return [elements, setElements] as const
}
