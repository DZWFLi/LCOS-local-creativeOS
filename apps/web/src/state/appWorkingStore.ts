import type { MutationBatch } from '@local-creative-os/contracts'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CanvasEdge, CanvasNode, Workspace } from '../model'

export type RuntimeOrigin = 'none' | 'fixture' | 'runtime'
export type RuntimeConnectionStatus = 'offline' | 'connecting' | 'online'

export interface CanvasSlice {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  canvasHydrated: boolean
  committedCanvas: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null
  canvasPast: { nodes: CanvasNode[]; edges: CanvasEdge[] }[]
  canvasFuture: { nodes: CanvasNode[]; edges: CanvasEdge[] }[]
  setCanvasGraph: (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void
  commitCanvasGraph: (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void
  undoCanvas: () => boolean
  redoCanvas: () => boolean
  resetCanvasHistory: (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void
}

export interface WorkspaceSlice {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  setWorkspaceState: (workspaces: Workspace[], activeWorkspaceId: string | null) => void
}

export interface SelectionSlice {
  selectedViewIds: string[]
  selectedRelationId: string | null
  setSelection: (selectedViewIds: string[], selectedRelationId?: string | null) => void
}

export interface InspectorSlice {
  inspectorOpen: boolean
  inspectorEntityId: string | null
  setInspector: (open: boolean, entityId?: string | null) => void
}

export interface QueuedMutation {
  readonly sequence: number
  readonly batch: MutationBatch
}

export interface MutationQueueSlice {
  inFlightMutation: QueuedMutation | null
  pendingMutations: QueuedMutation[]
  lastAcknowledgedSequence: number
  setMutationQueue: (state: Pick<MutationQueueSlice, 'inFlightMutation' | 'pendingMutations' | 'lastAcknowledgedSequence'>) => void
}

export interface RuntimeUiSlice {
  runtimeOrigin: RuntimeOrigin
  runtimeStatus: RuntimeConnectionStatus
  runtimeError: string | null
  setRuntimeUi: (state: Partial<Pick<RuntimeUiSlice, 'runtimeOrigin' | 'runtimeStatus' | 'runtimeError'>>) => void
}

export interface WorkingStateRehydrateInput {
  readonly nodes: CanvasNode[]
  readonly edges: CanvasEdge[]
  readonly workspaces: Workspace[]
  readonly activeWorkspaceId: string | null
  readonly runtimeOrigin?: RuntimeOrigin
  readonly runtimeStatus?: RuntimeConnectionStatus
}

export interface AppWorkingStore extends
  CanvasSlice,
  WorkspaceSlice,
  SelectionSlice,
  InspectorSlice,
  MutationQueueSlice,
  RuntimeUiSlice {
  rehydrateFromLocalCore: (input: WorkingStateRehydrateInput) => void
  resetWorkingState: () => void
}

type WorkingDataState = Omit<
  AppWorkingStore,
  | 'setCanvasGraph'
  | 'commitCanvasGraph'
  | 'undoCanvas'
  | 'redoCanvas'
  | 'resetCanvasHistory'
  | 'setWorkspaceState'
  | 'setSelection'
  | 'setInspector'
  | 'setMutationQueue'
  | 'setRuntimeUi'
  | 'rehydrateFromLocalCore'
  | 'resetWorkingState'
>

function initialWorkingData(): WorkingDataState {
  return {
    nodes: [],
    edges: [],
    canvasHydrated: false,
    committedCanvas: null,
    canvasPast: [],
    canvasFuture: [],
    workspaces: [],
    activeWorkspaceId: null,
    selectedViewIds: [],
    selectedRelationId: null,
    inspectorOpen: false,
    inspectorEntityId: null,
    inFlightMutation: null,
    pendingMutations: [],
    lastAcknowledgedSequence: 0,
    runtimeOrigin: 'none',
    runtimeStatus: 'offline',
    runtimeError: null,
  }
}

/**
 * Disposable Web working state. Project Truth is rehydrated explicitly from
 * Local Core; this module intentionally does not import Zustand persist.
 */
export const useAppWorkingStore = create<AppWorkingStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialWorkingData(),
    setCanvasGraph: (graph) => set({
      nodes: graph.nodes,
      edges: graph.edges,
      canvasHydrated: true,
    }),
    commitCanvasGraph: (graph) => set((state) => {
      const committed = state.committedCanvas
      if (committed !== null && canvasSignature(committed) === canvasSignature(graph)) return state
      return {
        committedCanvas: graph,
        canvasPast: committed === null ? [] : [...state.canvasPast.slice(-79), committed],
        canvasFuture: [],
      }
    }),
    undoCanvas: () => {
      const state = get()
      const current = { nodes: state.nodes, edges: state.edges }
      const committed = state.committedCanvas
      if (committed !== null && canvasSignature(current) !== canvasSignature(committed)) {
        set({ ...committed, canvasFuture: [...state.canvasFuture, current] })
        return true
      }
      const previous = state.canvasPast.at(-1)
      if (previous === undefined || committed === null) return false
      set({
        ...previous,
        committedCanvas: previous,
        canvasPast: state.canvasPast.slice(0, -1),
        canvasFuture: [...state.canvasFuture, committed],
      })
      return true
    },
    redoCanvas: () => {
      const state = get()
      const next = state.canvasFuture.at(-1)
      if (next === undefined) return false
      const committed = state.committedCanvas
      set({
        ...next,
        committedCanvas: next,
        canvasPast: committed === null ? state.canvasPast : [...state.canvasPast.slice(-79), committed],
        canvasFuture: state.canvasFuture.slice(0, -1),
      })
      return true
    },
    resetCanvasHistory: (graph) => set({
      ...graph,
      canvasHydrated: true,
      committedCanvas: graph,
      canvasPast: [],
      canvasFuture: [],
    }),
    setWorkspaceState: (workspaces, activeWorkspaceId) => set({ workspaces, activeWorkspaceId }),
    setSelection: (selectedViewIds, selectedRelationId = null) => set({ selectedViewIds, selectedRelationId }),
    setInspector: (inspectorOpen, inspectorEntityId = null) => set({ inspectorOpen, inspectorEntityId }),
    setMutationQueue: (state) => set(state),
    setRuntimeUi: (state) => set(state),
    rehydrateFromLocalCore: (input) => set({
      ...initialWorkingData(),
      nodes: input.nodes,
      edges: input.edges,
      canvasHydrated: true,
      committedCanvas: { nodes: input.nodes, edges: input.edges },
      workspaces: input.workspaces,
      activeWorkspaceId: input.activeWorkspaceId,
      runtimeOrigin: input.runtimeOrigin ?? 'runtime',
      runtimeStatus: input.runtimeStatus ?? 'online',
    }),
    resetWorkingState: () => set(initialWorkingData()),
  })),
)

function canvasSignature(graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }): string {
  return JSON.stringify({
    nodes: graph.nodes.map(({ previewUrl: _previewUrl, ...node }) => node),
    edges: graph.edges,
  })
}
