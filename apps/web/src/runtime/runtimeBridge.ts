import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import type { JsonValue } from '@local-creative-os/domain'
import type {
  Camera,
  CanvasEdge,
  CanvasNode,
  CanvasScope,
  PersistedPrototypeState,
  ProjectPackage,
  WorkRailPreferences,
  Workspace,
} from '../model'
import { createLocalCoreClient, type LocalCoreClient } from './localCoreClient'

export type DataSource = 'runtime' | 'none'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

export interface ProjectLoadResult {
  readonly source: DataSource
  readonly state: PersistedPrototypeState | null
  readonly error?: string
}

export interface CatalogLoadResult {
  readonly source: DataSource
  readonly projects: ProjectPackage[]
  readonly error?: string
}

export interface SaveResult {
  readonly status: SaveStatus
  readonly error?: string
}

export class RuntimeBridge {
  readonly client: LocalCoreClient
  readonly projectId: string
  #lastSavedSnapshot: string | null = null

  constructor(projectId: string, client?: LocalCoreClient) {
    this.projectId = projectId
    this.client = client ?? createLocalCoreClient()
  }

  async loadProject(): Promise<ProjectLoadResult> {
    try {
      const call = await this.client.projectGraph(this.projectId)
      if (!call.result.ok) {
        return { source: 'none', state: null, error: call.result.error.message }
      }
      const snapshot = call.result.value
      this.#lastSavedSnapshot = JSON.stringify(snapshot)
      const state = mapGraphToState(snapshot, this.projectId)
      return { source: 'runtime', state }
    } catch (err) {
      return { source: 'none', state: null, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async loadCatalog(): Promise<CatalogLoadResult> {
    try {
      const call = await this.client.catalog()
      if (!call.result.ok) {
        return { source: 'none', projects: [], error: call.result.error.message }
      }
      const projects: ProjectPackage[] = call.result.value.map((entry) => ({
        id: entry.id,
        label: entry.name,
        localPath: entry.rootPath,
        updatedAt: '',
        pendingCount: 0,
      }))
      return { source: 'runtime', projects }
    } catch (err) {
      return { source: 'none', projects: [], error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async saveProject(state: PersistedPrototypeState): Promise<SaveResult> {
    try {
      const snapshot = mapStateToGraph(state, this.projectId)
      const snapshotJson = JSON.stringify(snapshot)
      if (snapshotJson === this.#lastSavedSnapshot) {
        return { status: 'saved' }
      }
      const call = await this.client.saveProjectGraph(snapshot)
      if (!call.result.ok) {
        return { status: 'unsaved', error: call.result.error.message }
      }
      this.#lastSavedSnapshot = snapshotJson
      return { status: 'saved' }
    } catch (err) {
      return { status: 'unsaved', error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const call = await this.client.health()
      return call.result.ok
    } catch {
      return false
    }
  }
}

// ==================== Snapshot → AppState ====================

const KIND_TO_NODE: Record<string, CanvasNode['kind']> = {
  markdown: 'source',
  image: 'source',
  presentation: 'source',
  pdf: 'source',
  other: 'context',
}

export function mapGraphToState(graph: ProjectGraphSnapshot, projectId: string): PersistedPrototypeState {
  const artifactById = new Map(graph.artifacts.map((a) => [a.id, a]))

  const nodes: CanvasNode[] = graph.artifactViews.map((view) => {
    const artifact = artifactById.get(view.artifactId)
    const isStale = artifact?.availability === 'stale'
    const isMissing = artifact?.availability === 'missing'
    return {
      id: view.id,
      kind: artifact ? (KIND_TO_NODE[artifact.kind] ?? 'context') : 'context',
      title: artifact?.title ?? String(view.id),
      subtitle: artifact?.kind ?? '',
      x: view.position.x,
      y: view.position.y,
      width: view.size.width,
      height: view.size.height,
      displayMode: view.displayMode === 'compact' ? 'compact' as const : 'standard' as const,
      draft: isStale,
      current: !isStale,
      disabled: isMissing,
      fileType: artifact?.kind,
      scopeId: 'scope-root',
    }
  })

  const edges: CanvasEdge[] = graph.relations.map((rel) => ({
    id: String(rel.id),
    from: String(rel.sourceArtifactViewId),
    to: String(rel.targetArtifactViewId),
    kind: (rel.kind === 'informs' || rel.kind === 'reference') ? 'reference' as const : 'modify' as const,
    active: false,
  }))

  const camera0: Camera = graph.workspaces[0]?.viewport ?? { x: 0, y: 0, zoom: 1 }

  const workspaces: Workspace[] = graph.workspaces.map((ws) => ({
    id: String(ws.id),
    label: ws.name,
    intent: (ws.intent ?? null) as Workspace['intent'],
    scopeId: String(ws.id),
    camera: { x: ws.viewport.x, y: ws.viewport.y, zoom: ws.viewport.zoom },
    visibleLayers: ['core', 'process'] as Workspace['visibleLayers'],
    focusedNodeIds: ws.focusedNodeIds as string[],
    contextPolicy: 'selection-only' as const,
    createdAt: ws.updatedAt,
    updatedAt: ws.updatedAt,
  }))

  const scopes: CanvasScope[] = workspaces.map((ws) => ({
    id: 'scope-root',
    label: ws.label,
    kind: 'root' as const,
    parentScopeId: null,
    camera: ws.camera,
  }))

  const workRail: WorkRailPreferences = { pinned: true, collapsed: false, width: 350 }

  return {
    version: 9,
    projectId,
    nodes: nodes.length > 0 ? nodes : [],
    edges,
    workspaces: workspaces.length > 0 ? workspaces : [defaultWorkspace()],
    scopes: scopes.length > 0 ? scopes : [{ id: 'scope-root', label: 'Root', kind: 'root', parentScopeId: null, camera: camera0 }],
    activeWorkspaceId: workspaces[0]?.id ?? 'workspace-main',
    activeScopeId: scopes[0]?.id ?? 'scope-root',
    workRail,
  }
}

function defaultWorkspace(): Workspace {
  return {
    id: 'workspace-main', label: 'Main', intent: null, scopeId: 'scope-root',
    camera: { x: 0, y: 0, zoom: 1 }, visibleLayers: ['core', 'process'],
    focusedNodeIds: [], contextPolicy: 'selection-only',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}

// ==================== AppState → Snapshot ====================

export function mapStateToGraph(state: PersistedPrototypeState, projectId: string): ProjectGraphSnapshot {
  const now = new Date().toISOString()

  const workspaces: ProjectGraphSnapshot['workspaces'] = state.workspaces.map((ws) => ({
    id: ws.id as ProjectGraphSnapshot['workspaces'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['workspaces'][number]['projectId'],
    name: ws.label,
    intent: ws.intent,
    viewport: { x: ws.camera.x, y: ws.camera.y, zoom: ws.camera.zoom },
    focusedNodeIds: ws.focusedNodeIds,
    visibleLayers: ws.visibleLayers,
    updatedAt: now,
  }))

  const coreNodes = state.nodes.filter((n) => n.kind !== 'process' && n.kind !== 'note' && n.kind !== 'decision')
  const artifacts: ProjectGraphSnapshot['artifacts'] = coreNodes.map((n) => ({
    id: n.id as ProjectGraphSnapshot['artifacts'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['artifacts'][number]['projectId'],
    title: n.title,
    kind: kindToArtifactKind(n.kind),
    localPath: `disposable://${n.id}`,
    availability: n.disabled ? 'missing' as const : n.draft ? 'stale' as const : 'available' as const,
    createdAt: now,
    updatedAt: now,
  }))

  const artifactViews: ProjectGraphSnapshot['artifactViews'] = coreNodes.map((n) => ({
    id: n.id as ProjectGraphSnapshot['artifactViews'][number]['id'],
    artifactId: n.id as ProjectGraphSnapshot['artifactViews'][number]['artifactId'],
    workspaceId: state.activeWorkspaceId as ProjectGraphSnapshot['artifactViews'][number]['workspaceId'],
    referenceKind: 'primary' as const,
    position: { x: n.x, y: n.y },
    size: { width: n.width, height: n.height },
    displayMode: n.displayMode === 'compact' ? 'compact' as const : 'card' as const,
    collapsed: false,
  }))

  const relations: ProjectGraphSnapshot['relations'] = state.edges.map((e) => ({
    id: e.id as ProjectGraphSnapshot['relations'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['relations'][number]['projectId'],
    workspaceId: state.activeWorkspaceId as ProjectGraphSnapshot['relations'][number]['workspaceId'],
    sourceArtifactViewId: e.from as ProjectGraphSnapshot['relations'][number]['sourceArtifactViewId'],
    targetArtifactViewId: e.to as ProjectGraphSnapshot['relations'][number]['targetArtifactViewId'],
    kind: e.kind,
    createdAt: now,
    updatedAt: now,
  }))

  const checkpoints: ProjectGraphSnapshot['checkpoints'] = [{
    id: `cp-${Date.now()}` as ProjectGraphSnapshot['checkpoints'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['checkpoints'][number]['projectId'],
    workspaceId: state.activeWorkspaceId as ProjectGraphSnapshot['checkpoints'][number]['workspaceId'],
    artifactRevisionIds: [],
    relatedRunIds: [],
    canvasSnapshot: { camera: state.scopes[0]?.camera ?? { x: 0, y: 0, zoom: 1 } } as unknown as JsonValue,
    createdAt: now,
  }]

  return {
    schemaVersion: 2,
    project: { id: projectId as ProjectGraphSnapshot['project']['id'], name: 'PortaSplit', rootPath: 'disposable://portasplit', createdAt: now, updatedAt: now },
    workspaces,
    artifacts,
    artifactViews,
    relations,
    notes: [],
    artifactRevisions: [],
    checkpoints,
  }
}

function kindToArtifactKind(kind: CanvasNode['kind']): 'markdown' | 'image' | 'presentation' | 'pdf' | 'other' {
  if (kind === 'source' || kind === 'working') return 'markdown'
  if (kind === 'generated') return 'image'
  return 'other'
}
