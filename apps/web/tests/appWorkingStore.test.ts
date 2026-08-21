import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasNode, Workspace } from '../src/model'
import { useAppWorkingStore } from '../src/state/appWorkingStore'

function node(id: string, x = 0): CanvasNode {
  return {
    id,
    kind: 'source',
    title: id,
    subtitle: '',
    x,
    y: 0,
    width: 200,
    height: 120,
  }
}

const workspace: Workspace = {
  id: 'workspace-1',
  label: 'Main',
  intent: null,
  scopeId: 'scope-root',
  camera: { x: 0, y: 0, zoom: 1 },
  visibleLayers: ['core'],
  focusedViewIds: ['view-a'],
  contextPolicy: 'selection-only',
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
}

describe('AppWorkingStore', () => {
  beforeEach(() => {
    useAppWorkingStore.getState().resetWorkingState()
  })

  it('is disposable and rehydrates authoritative state from Local Core', () => {
    const state = useAppWorkingStore.getState()
    state.setCanvasGraph({ nodes: [node('optimistic')], edges: [] })
    state.setSelection(['optimistic'])
    state.setInspector(true, 'optimistic')
    state.setRuntimeUi({ runtimeError: 'offline' })

    state.resetWorkingState()
    expect(useAppWorkingStore.getState().nodes).toEqual([])
    expect(useAppWorkingStore.getState().selectedViewIds).toEqual([])

    useAppWorkingStore.getState().rehydrateFromLocalCore({
      nodes: [node('view-a', 42)],
      edges: [],
      workspaces: [workspace],
      activeWorkspaceId: workspace.id,
    })

    const rehydrated = useAppWorkingStore.getState()
    expect(rehydrated.nodes).toEqual([node('view-a', 42)])
    expect(rehydrated.workspaces).toEqual([workspace])
    expect(rehydrated.selectedViewIds).toEqual([])
    expect(rehydrated.inFlightMutation).toBeNull()
    expect(rehydrated.runtimeOrigin).toBe('runtime')
  })

  it('does not use Zustand persist or browser storage', () => {
    const sourcePath = fileURLToPath(new URL('../src/state/appWorkingStore.ts', import.meta.url))
    const source = readFileSync(sourcePath, 'utf8')
    expect(source).not.toMatch(/import\s*\{[^}]*\bpersist\b/)
    expect(source).not.toMatch(/\blocalStorage\b/)
  })

  it('notifies a selector only when its selected slice changes', () => {
    const listener = vi.fn()
    const unsubscribe = useAppWorkingStore.subscribe((state) => state.nodes, listener)

    useAppWorkingStore.getState().setRuntimeUi({ runtimeStatus: 'connecting' })
    expect(listener).not.toHaveBeenCalled()

    useAppWorkingStore.getState().setCanvasGraph({ nodes: [node('view-a')], edges: [] })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('keeps undo and redo ordered around the authoritative Canvas slice', () => {
    const initial = { nodes: [node('view-a', 0)], edges: [] }
    const moved = { nodes: [node('view-a', 120)], edges: [] }
    const state = useAppWorkingStore.getState()

    state.resetCanvasHistory(initial)
    state.setCanvasGraph(moved)
    expect(state.undoCanvas()).toBe(true)
    expect(useAppWorkingStore.getState().nodes[0]?.x).toBe(0)
    expect(state.redoCanvas()).toBe(true)
    expect(useAppWorkingStore.getState().nodes[0]?.x).toBe(120)
  })
})
