import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CanvasEdge, CanvasNode } from '../model'
import { useAppWorkingStore } from './appWorkingStore'

export interface CanvasGraphSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

type StateUpdater<T> = T | ((current: T) => T)

function resolve<T>(current: T, updater: StateUpdater<T>): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(current) : updater
}

export function useCanvasHistory(initial: CanvasGraphSnapshot) {
  if (!useAppWorkingStore.getState().canvasHydrated) {
    useAppWorkingStore.getState().resetCanvasHistory(initial)
  }
  const nodes = useAppWorkingStore((state) => state.nodes)
  const edges = useAppWorkingStore((state) => state.edges)
  const setCanvasGraph = useAppWorkingStore((state) => state.setCanvasGraph)
  const commitCanvasGraph = useAppWorkingStore((state) => state.commitCanvasGraph)
  const undoCanvas = useAppWorkingStore((state) => state.undoCanvas)
  const redoCanvas = useAppWorkingStore((state) => state.redoCanvas)
  const resetCanvasHistory = useAppWorkingStore((state) => state.resetCanvasHistory)
  const snapshot = useMemo(() => ({ nodes, edges }), [nodes, edges])
  const timerRef = useRef<number | null>(null)
  const restoringRef = useRef(false)

  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      commitCanvasGraph(snapshot)
    }, 180)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [commitCanvasGraph, snapshot])

  const setGraph = useCallback((updater: StateUpdater<CanvasGraphSnapshot>) => {
    const current = useAppWorkingStore.getState()
    setCanvasGraph(resolve({ nodes: current.nodes, edges: current.edges }, updater))
  }, [setCanvasGraph])

  const setNodes = useCallback((updater: StateUpdater<CanvasNode[]>) => {
    const current = useAppWorkingStore.getState()
    setCanvasGraph({ nodes: resolve(current.nodes, updater), edges: current.edges })
  }, [setCanvasGraph])

  const setEdges = useCallback((updater: StateUpdater<CanvasEdge[]>) => {
    const current = useAppWorkingStore.getState()
    setCanvasGraph({ nodes: current.nodes, edges: resolve(current.edges, updater) })
  }, [setCanvasGraph])

  const undo = useCallback((): boolean => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const restored = undoCanvas()
    restoringRef.current = restored
    return restored
  }, [undoCanvas])


  const resetGraph = useCallback((next: CanvasGraphSnapshot) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    restoringRef.current = true
    resetCanvasHistory(next)
  }, [resetCanvasHistory])

  const redo = useCallback((): boolean => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const restored = redoCanvas()
    restoringRef.current = restored
    return restored
  }, [redoCanvas])

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    setGraph,
    undo,
    redo,
    resetGraph,
  }
}
