import type { GraphVersion, ProjectGraphSnapshot, Scope, WorkspaceContextPolicy } from '@local-creative-os/contracts'
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
    } catch { return false }
  }
}

// ==================== GraphSnapshot → AppState ====================

const KIND_TO_NODE: Record<string, CanvasNode['kind']> = {
  markdown: 'source', image: 'source', presentation: 'source', pdf: 'source', other: 'context',
}

export function mapGraphToState(graph: ProjectGraphSnapshot, projectId: string): PersistedPrototypeState {
  const artifactById = new Map(graph.artifacts.map((a) => [a.id, a]))

  const nodes: CanvasNode[] = graph.artifactViews.map((view) => {
    const artifact = artifactById.get(view.artifactId)
    const isStale = artifact?.availability === 'stale'
    const isMissing = artifact?.availability === 'missing'
    return {
      id: String(view.id),
      kind: artifact ? (KIND_TO_NODE[artifact.kind] ?? 'context') : 'context',
      title: artifact?.title ?? String(view.id),
      subtitle: artifact?.kind ?? '',
      x: view.position.x, y: view.position.y,
      width: view.size.width, height: view.size.height,
      displayMode: view.displayMode === 'compact' ? 'compact' as const : 'standard' as const,
      draft: isStale, current: !isStale, disabled: isMissing,
      fileType: artifact?.kind,
      scopeId: String(view.scopeId),
    }
  })

  const edges: CanvasEdge[] = graph.relations.map((rel) => ({
    id: String(rel.id),
    from: String(rel.sourceEntityId),
    to: String(rel.targetEntityId),
    kind: (rel.kind === 'informs' || rel.kind === 'reference') ? 'reference' as const : 'modify' as const,
    active: false,
  }))

  // Workspaces from snapshot
  const workspaces: Workspace[] = graph.workspaces.map((ws) => ({
    id: String(ws.id),
    label: ws.name,
    intent: (ws.intent ?? null) as Workspace['intent'],
    scopeId: String(ws.scopeId),
    camera: { x: ws.viewport.x, y: ws.viewport.y, zoom: ws.viewport.zoom },
    visibleLayers: (ws.visibleLayers as Workspace['visibleLayers']) ?? ['core', 'process'],
    focusedNodeIds: ws.focusedNodeIds as string[],
    contextPolicy: (ws.contextPolicy ?? 'selection-only') as Workspace['contextPolicy'],
    createdAt: ws.updatedAt, updatedAt: ws.updatedAt,
  }))

  // Scopes from snapshot
  const scopes: CanvasScope[] = graph.scopes.length > 0
    ? graph.scopes.map((s: Scope) => ({
        id: String(s.id), label: s.name,
        kind: s.kind as CanvasScope['kind'],
        parentScopeId: s.parentScopeId ? String(s.parentScopeId) : null,
        camera: workspaces.find((w) => w.scopeId === String(s.id))?.camera ?? { x: 0, y: 0, zoom: 1 },
      }))
    : workspaces.map((ws) => ({ id: 'scope-root', label: ws.label, kind: 'root' as const, parentScopeId: null, camera: ws.camera }))

  const defaultCamera = scopes[0]?.camera ?? { x: 0, y: 0, zoom: 1 }
  const firstWkid = workspaces[0]?.id ?? 'workspace-main'

  const workRail: WorkRailPreferences = { pinned: true, collapsed: false, width: 350 }

  return {
    version: 9, projectId, nodes, edges,
    workspaces: workspaces.length > 0 ? workspaces : [defaultWorkspace()],
    scopes: scopes.length > 0 ? scopes : [{ id: 'scope-root', label: 'Root', kind: 'root', parentScopeId: null, camera: defaultCamera }],
    activeWorkspaceId: firstWkid,
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

// ==================== AppState → GraphSnapshot ====================

export function mapStateToGraph(state: PersistedPrototypeState, projectId: string): ProjectGraphSnapshot {
  const now = new Date().toISOString()
  const graphVersion = 1 as GraphVersion // increment handled by server

  // Scopes
  const scopes: ProjectGraphSnapshot['scopes'] = state.scopes.map((s) => ({
    id: s.id as ProjectGraphSnapshot['scopes'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['scopes'][number]['projectId'],
    parentScopeId: s.parentScopeId ? (s.parentScopeId as ProjectGraphSnapshot['scopes'][number]['parentScopeId']) : null,
    containerViewId: null,
    kind: (s.kind ?? 'root') as ProjectGraphSnapshot['scopes'][number]['kind'],
    name: s.label,
    createdAt: now, updatedAt: now,
  }))

  // Workspaces
  const workspaces: ProjectGraphSnapshot['workspaces'] = state.workspaces.map((ws) => ({
    id: ws.id as ProjectGraphSnapshot['workspaces'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['workspaces'][number]['projectId'],
    scopeId: ws.scopeId as ProjectGraphSnapshot['workspaces'][number]['scopeId'],
    name: ws.label, intent: ws.intent,
    viewport: { x: ws.camera.x, y: ws.camera.y, zoom: ws.camera.zoom },
    focusedNodeIds: ws.focusedNodeIds,
    visibleLayers: ws.visibleLayers,
    contextPolicy: (ws.contextPolicy ?? 'selection-only') as WorkspaceContextPolicy,
    updatedAt: now,
  }))

  // Artifacts + ArtifactViews from core nodes (filter out process/note/decision)
  const coreNodes = state.nodes.filter((n) => n.kind !== 'process' && n.kind !== 'note' && n.kind !== 'decision')
  const artifacts: ProjectGraphSnapshot['artifacts'] = coreNodes.map((n) => ({
    id: n.id as ProjectGraphSnapshot['artifacts'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['artifacts'][number]['projectId'],
    title: n.title,
    kind: kindToArtifactKind(n.kind) as ProjectGraphSnapshot['artifacts'][number]['kind'],
    localPath: `disposable://${n.id}`,
    availability: n.disabled ? 'missing' as const : n.draft ? 'stale' as const : 'available' as const,
    createdAt: now, updatedAt: now,
  }))

  const artifactViews: ProjectGraphSnapshot['artifactViews'] = coreNodes.map((n) => ({
    id: n.id as ProjectGraphSnapshot['artifactViews'][number]['id'],
    artifactId: n.id as ProjectGraphSnapshot['artifactViews'][number]['artifactId'],
    scopeId: (n.scopeId ?? state.activeScopeId) as ProjectGraphSnapshot['artifactViews'][number]['scopeId'],
    referenceKind: 'primary' as const,
    position: { x: n.x, y: n.y },
    size: { width: n.width, height: n.height },
    displayMode: n.displayMode === 'compact' ? 'compact' as const : 'card' as const,
    collapsed: false,
  }))

  // Relations: entity-based (sourceEntityType/sourceEntityId)
  const relations: ProjectGraphSnapshot['relations'] = state.edges.map((e) => ({
    id: e.id as ProjectGraphSnapshot['relations'][number]['id'],
    projectId: projectId as ProjectGraphSnapshot['relations'][number]['projectId'],
    sourceEntityType: 'artifact' as const,
    sourceEntityId: e.from as ProjectGraphSnapshot['relations'][number]['sourceEntityId'],
    targetEntityType: 'artifact' as const,
    targetEntityId: e.to as ProjectGraphSnapshot['relations'][number]['targetEntityId'],
    kind: e.kind,
    createdAt: now, updatedAt: now,
  }))

  return {
    schemaVersion: 3,
    graphVersion,
    project: { id: projectId as ProjectGraphSnapshot['project']['id'], name: 'PortaSplit', rootPath: 'disposable://portasplit', graphVersion, createdAt: now, updatedAt: now },
    scopes,
    workspaces,
    artifacts,
    artifactViews,
    relations,
    notes: [],
    artifactRevisions: [],
    checkpoints: [],
  }
}

function kindToArtifactKind(kind: string): string {
  if (kind === 'source' || kind === 'working') return 'markdown'
  if (kind === 'generated') return 'image'
  return 'other'
}
