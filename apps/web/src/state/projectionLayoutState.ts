import { useEffect, useMemo, useState } from 'react'

export type ProjectionSurfaceKey = 'outline' | 'context-flow' | 'context-tree' | 'context-graph' | 'work' | 'deliver'

export interface ProjectionLayoutState {
  orderIds: string[]
  depthById: Record<string, number>
  collapsedIds: string[]
  rootIds: string[]
  collapsedAxisIds: string[]
  hops: 1 | 2
  relationKinds: string[]
  selectedRevisionIds: string[]
}

const EMPTY: ProjectionLayoutState = {
  orderIds: [],
  depthById: {},
  collapsedIds: [],
  rootIds: [],
  collapsedAxisIds: [],
  hops: 2,
  relationKinds: ['reference', 'generate', 'modify', 'feedback'],
  selectedRevisionIds: [],
}

const memory = new Map<string, ProjectionLayoutState>()

function keyOf(projectId: string, scopeId: string, surface: ProjectionSurfaceKey) {
  return `lcos:projection:${projectId}:${scopeId}:${surface}`
}

function read(key: string, fallback: Partial<ProjectionLayoutState>): ProjectionLayoutState {
  const base = { ...EMPTY, ...fallback }
  const cached = memory.get(key)
  if (cached) return { ...base, ...cached }
  if (typeof window === 'undefined') return base
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<ProjectionLayoutState>
    const value = { ...base, ...parsed }
    memory.set(key, value)
    return value
  } catch {
    return base
  }
}

function write(key: string, value: ProjectionLayoutState) {
  memory.set(key, value)
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* local browser policy */ }
}

/** Projection-only UI state. It never writes Arrange coordinates or canonical project objects. */
export function useProjectionLayoutState(projectId: string, scopeId: string, surface: ProjectionSurfaceKey, fallback: Partial<ProjectionLayoutState> = {}) {
  const key = useMemo(() => keyOf(projectId, scopeId, surface), [projectId, scopeId, surface])
  const [state, setState] = useState<ProjectionLayoutState>(() => read(key, fallback))
  useEffect(() => { setState(read(key, fallback)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { write(key, state) }, [key, state])
  return [state, setState] as const
}
