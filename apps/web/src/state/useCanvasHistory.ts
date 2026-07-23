import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasEdge, CanvasNode } from '../model'

export interface CanvasGraphSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

type StateUpdater<T> = T | ((current: T) => T)

function resolve<T>(current: T, updater: StateUpdater<T>): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(current) : updater
}

function signature(snapshot: CanvasGraphSnapshot): string {
  return JSON.stringify({
    nodes: snapshot.nodes.map(({ previewUrl: _previewUrl, ...node }) => node),
    edges: snapshot.edges,
  })
}

export function useCanvasHistory(initial: CanvasGraphSnapshot) {
  const [snapshot, setSnapshot] = useState<CanvasGraphSnapshot>(initial)
  const snapshotRef = useRef(snapshot)
  const committedRef = useRef(initial)
  const committedSignatureRef = useRef(signature(initial))
  const pastRef = useRef<CanvasGraphSnapshot[]>([])
  const futureRef = useRef<CanvasGraphSnapshot[]>([])
  const timerRef = useRef<number | null>(null)
  const restoringRef = useRef(false)

  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])

  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false
      committedRef.current = snapshot
      committedSignatureRef.current = signature(snapshot)
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const nextSignature = signature(snapshot)
      if (nextSignature === committedSignatureRef.current) return
      pastRef.current = [...pastRef.current.slice(-79), committedRef.current]
      committedRef.current = snapshot
      committedSignatureRef.current = nextSignature
      futureRef.current = []
    }, 180)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [snapshot])

  const setGraph = useCallback((updater: StateUpdater<CanvasGraphSnapshot>) => {
    setSnapshot((current) => resolve(current, updater))
  }, [])

  const setNodes = useCallback((updater: StateUpdater<CanvasNode[]>) => {
    setSnapshot((current) => ({ ...current, nodes: resolve(current.nodes, updater) }))
  }, [])

  const setEdges = useCallback((updater: StateUpdater<CanvasEdge[]>) => {
    setSnapshot((current) => ({ ...current, edges: resolve(current.edges, updater) }))
  }, [])

  const undo = useCallback((): boolean => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const current = snapshotRef.current
    const currentSignature = signature(current)
    if (currentSignature !== committedSignatureRef.current) {
      futureRef.current.push(current)
      restoringRef.current = true
      setSnapshot(committedRef.current)
      return true
    }
    const previous = pastRef.current.pop()
    if (!previous) return false
    futureRef.current.push(committedRef.current)
    committedRef.current = previous
    committedSignatureRef.current = signature(previous)
    restoringRef.current = true
    setSnapshot(previous)
    return true
  }, [])


  const resetGraph = useCallback((next: CanvasGraphSnapshot) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pastRef.current = []
    futureRef.current = []
    committedRef.current = next
    committedSignatureRef.current = signature(next)
    snapshotRef.current = next
    restoringRef.current = true
    setSnapshot(next)
  }, [])

  const redo = useCallback((): boolean => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const next = futureRef.current.pop()
    if (!next) return false
    pastRef.current.push(committedRef.current)
    committedRef.current = next
    committedSignatureRef.current = signature(next)
    restoringRef.current = true
    setSnapshot(next)
    return true
  }, [])

  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    setNodes,
    setEdges,
    setGraph,
    undo,
    redo,
    resetGraph,
  }
}
