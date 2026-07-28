import type { GraphVersion, ProjectGraphSnapshot, Scope, WorkspaceContextPolicy, MutationBatch } from '@local-creative-os/contracts'
import type {
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
  #acknowledgedState: PersistedPrototypeState | null = null

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
      this.#graphVersion = Number(snapshot.graphVersion) || 1
      this.#acknowledgedState = cloneState(state)
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

  #graphVersion: number = 1
  #saveQueue: Promise<void> = Promise.resolve()
  #pendingBatches = 0
  #lastAcknowledgedSequence = 0
  #nextSequence = 0

  get pendingMutationCount(): number {
    return this.#pendingBatches
  }

  /** Runtime save — compute action-level deltas at execution time. */
  async saveMutations(state: PersistedPrototypeState): Promise<SaveResult> {
    const desiredState = cloneState(state)
    const sequence = ++this.#nextSequence
    this.#pendingBatches += 1
    const task = this.#saveQueue.then(async () => {
      if (sequence <= this.#lastAcknowledgedSequence) {
        return { status: 'unsaved' as const, error: 'A stale save response was discarded.' }
      }
      if (this.#acknowledgedState === null) {
        const bootstrap = await this.#bootstrapProject(desiredState)
        if (bootstrap.status !== 'saved') return bootstrap
        this.#lastAcknowledgedSequence = sequence
        return { status: 'saved' as const }
      }
      const ops = diffStateToOps(this.#acknowledgedState, desiredState, this.projectId)
      if (ops.length === 0) {
        this.#lastAcknowledgedSequence = sequence
        this.#acknowledgedState = desiredState
        return { status: 'saved' as const }
      }
      const result = await this.#executeMutations(ops)
      if (result.status === 'saved') {
        this.#lastAcknowledgedSequence = sequence
        this.#acknowledgedState = desiredState
      }
      return result
    })
    this.#saveQueue = task.then(
      () => { this.#pendingBatches -= 1 },
      () => { this.#pendingBatches -= 1 },
    )
    return task
  }

  /** Low-level raw operation path, serialized behind state saves. */
  async sendMutations(ops: MutationBatch['ops']): Promise<SaveResult> {
    const sequence = ++this.#nextSequence
    this.#pendingBatches += 1
    const task = this.#saveQueue.then(async () => {
      const result = await this.#executeMutations(ops)
      if (result.status === 'saved') {
        this.#lastAcknowledgedSequence = sequence
        this.#acknowledgedState = null
      }
      return result
    })
    this.#saveQueue = task.then(
      () => { this.#pendingBatches -= 1 },
      () => { this.#pendingBatches -= 1 },
    )
    return task
  }

  async #executeMutations(ops: MutationBatch['ops']): Promise<SaveResult> {
    try {
      const batch: MutationBatch = {
        baseVersion: this.#graphVersion as GraphVersion,
        ops: [...ops],
      }
      const call = await this.client.applyMutations(batch, this.projectId)
      if (!call.result.ok) {
        if (call.result.error.code === 'STALE_GRAPH_VERSION') {
          await this.loadProject()
          return { status: 'unsaved', error: 'Project changed in Local Core. Runtime state was reloaded; retry the edit.' }
        }
        return { status: 'unsaved', error: call.result.error.message }
      }
      this.#graphVersion = Number(call.result.value.graphVersion)
      return { status: 'saved' }
    } catch (err) {
      return { status: 'unsaved', error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async #bootstrapProject(state: PersistedPrototypeState): Promise<SaveResult> {
    const snapshot = mapStateToGraph(state, this.projectId)
    const call = await this.client.saveProjectGraph(snapshot)
    if (!call.result.ok) {
      return { status: 'unsaved', error: call.result.error.message }
    }
    this.#lastSavedSnapshot = JSON.stringify(call.result.value)
    this.#graphVersion = Number(call.result.value.graphVersion) || 1
    this.#acknowledgedState = cloneState(state)
    return { status: 'saved' }
  }

  /** Full snapshot save — import/recovery/test ONLY. NOT for runtime edits. */
  async saveProject(state: PersistedPrototypeState): Promise<SaveResult> {
    try {
      const snapshotJson = JSON.stringify(mapStateToGraph(state, this.projectId))
      if (snapshotJson === this.#lastSavedSnapshot) {
        return { status: 'saved' }
      }
      return await this.#bootstrapProject(state)
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
  const revisionById = new Map(graph.artifactRevisions.map((revision) => [revision.id, revision]))
  const fileRecordById = new Map(graph.fileRecords.map((fileRecord) => [fileRecord.id, fileRecord]))

  const nodes: CanvasNode[] = graph.artifactViews.map((view) => {
    const artifact = artifactById.get(view.artifactId)
    const revisionId = view.revisionId ?? artifact?.currentRevisionId
    const revision = revisionId === undefined ? undefined : revisionById.get(revisionId)
    const fileRecord = revision === undefined ? undefined : fileRecordById.get(revision.fileRecordId)
    const isStale = artifact?.availability === 'stale'
    const isMissing = artifact?.availability === 'missing'
    return {
      id: String(view.id),
      kind: artifact ? (KIND_TO_NODE[artifact.kind] ?? 'context') : 'context',
      title: artifact?.title ?? String(view.id),
      subtitle: artifact?.kind ? `${artifact.kind}${fileRecord ? ' · Runtime source' : ''}` : '',
      x: view.position.x, y: view.position.y,
      width: view.size.width, height: view.size.height,
      displayMode: view.displayMode === 'compact' ? 'compact' as const : 'standard' as const,
      draft: isStale, current: !isStale, disabled: isMissing,
      fileType: artifact?.kind,
      artifactId: artifact === undefined ? undefined : String(artifact.id),
      revisionId: revisionId === undefined ? undefined : String(revisionId),
      fileRecordId: revision === undefined ? undefined : String(revision.fileRecordId),
      contentHash: revision === undefined ? undefined : String(revision.contentHash),
      observedPath: fileRecord?.observedPath,
      followsCurrentRevision: artifact?.currentRevisionId !== undefined && revisionId === artifact.currentRevisionId,
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
    focusedViewIds: ws.focusedViewIds.map(String),
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
  const workRail: WorkRailPreferences = { pinned: true, collapsed: false, width: 350 }

  return {
    version: 10, projectId, nodes, edges,
    workspaces: workspaces.length > 0 ? workspaces : [defaultWorkspace()],
    scopes: scopes.length > 0 ? scopes : [{ id: 'scope-root', label: 'Root', kind: 'root', parentScopeId: null, camera: defaultCamera }],
    activeWorkspaceId: null,
    activeScopeId: scopes[0]?.id ?? 'scope-root',
    workRail,
  }
}

function defaultWorkspace(): Workspace {
  return {
    id: 'workspace-main', label: 'Main', intent: null, scopeId: 'scope-root',
    camera: { x: 0, y: 0, zoom: 1 }, visibleLayers: ['core', 'process'],
    focusedViewIds: [], contextPolicy: 'selection-only',
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
    focusedViewIds: ws.focusedViewIds as unknown as ProjectGraphSnapshot['workspaces'][number]['focusedViewIds'],
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
    fileRecords: [],
    artifactRevisions: [],
    checkpoints: [],
  }
}

function kindToArtifactKind(kind: string): string {
  if (kind === 'source' || kind === 'working') return 'markdown'
  if (kind === 'generated') return 'image'
  return 'other'
}

/** Build action-level mutations by comparing the last acknowledged state. */
export function diffStateToOps(
  previous: PersistedPrototypeState,
  state: PersistedPrototypeState,
  projectId: string,
): MutationBatch['ops'] {
  const now = new Date().toISOString()
  const ops: { type: string; [key: string]: unknown }[] = []
  const scopeId = state.activeScopeId || 'scope-root'
  const previousScopes = new Map(previous.scopes.map((scope) => [scope.id, scope]))
  const previousWorkspaces = new Map(previous.workspaces.map((workspace) => [workspace.id, workspace]))
  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]))
  const previousEdges = new Map(previous.edges.map((edge) => [edge.id, edge]))

  for (const s of state.scopes) {
    const before = previousScopes.get(s.id)
    if (before === undefined || before.label !== s.label || before.kind !== s.kind || before.parentScopeId !== s.parentScopeId) {
      ops.push({ type: 'upsert_scope', scope: { id: s.id, projectId, parentScopeId: s.parentScopeId ?? null, containerViewId: null, kind: s.kind || 'root', name: s.label, createdAt: now, updatedAt: now } })
    }
  }

  for (const ws of state.workspaces) {
    const before = previousWorkspaces.get(ws.id)
    const workspace = {
      id: ws.id,
      projectId,
      scopeId: ws.scopeId,
      name: ws.label,
      intent: ws.intent,
      viewport: { x: ws.camera.x, y: ws.camera.y, zoom: ws.camera.zoom },
      focusedViewIds: ws.focusedViewIds,
      visibleLayers: ws.visibleLayers,
      contextPolicy: ws.contextPolicy ?? 'selection-only',
      updatedAt: now,
    }
    if (before === undefined
      || before.label !== ws.label
      || before.intent !== ws.intent
      || before.scopeId !== ws.scopeId
      || before.contextPolicy !== ws.contextPolicy) {
      ops.push({ type: 'upsert_workspace', workspace })
      continue
    }
    if (!sameValue(before.focusedViewIds, ws.focusedViewIds) || !sameValue(before.visibleLayers, ws.visibleLayers)) {
      ops.push({
        type: 'update_workspace_presentation',
        workspaceId: ws.id,
        focusedViewIds: ws.focusedViewIds,
        visibleLayers: ws.visibleLayers,
      })
    }
  }

  const coreNodes = state.nodes.filter(n => n.kind !== 'process' && n.kind !== 'note' && n.kind !== 'decision')
  for (const n of coreNodes) {
    const before = previousNodes.get(n.id)
    const artifact = {
      id: n.id,
      projectId,
      title: n.title,
      kind: kindToArtifactKind(n.kind),
      availability: n.disabled ? 'missing' : n.draft ? 'stale' : 'available',
      createdAt: now,
      updatedAt: now,
    }
    const view = {
      id: n.id,
      artifactId: n.id,
      scopeId: n.scopeId ?? scopeId,
      referenceKind: 'primary',
      position: { x: n.x, y: n.y },
      size: { width: n.width, height: n.height },
      displayMode: n.displayMode === 'compact' ? 'compact' : 'card',
      collapsed: false,
    }
    if (before === undefined) {
      ops.push({ type: 'upsert_artifact', artifact })
      ops.push({ type: 'upsert_artifact_view', view })
      continue
    }
    if (before.title !== n.title || before.kind !== n.kind || before.disabled !== n.disabled || before.draft !== n.draft) {
      ops.push({ type: 'upsert_artifact', artifact })
    }
    if ((before.scopeId ?? previous.activeScopeId) !== view.scopeId) {
      ops.push({ type: 'upsert_artifact_view', view })
      continue
    }
    if (before.x !== n.x || before.y !== n.y) {
      ops.push({ type: 'move_artifact_view', viewId: n.id, x: n.x, y: n.y })
    }
    if (before.width !== n.width || before.height !== n.height) {
      ops.push({ type: 'resize_artifact_view', viewId: n.id, width: n.width, height: n.height })
    }
    if (before.displayMode !== n.displayMode) {
      ops.push({ type: 'update_artifact_view_presentation', viewId: n.id, collapsed: false, displayMode: view.displayMode })
    }
  }
  const coreNodeIds = new Set(coreNodes.map((node) => node.id))
  for (const node of previous.nodes) {
    if (node.kind !== 'process' && node.kind !== 'note' && node.kind !== 'decision' && !coreNodeIds.has(node.id)) {
      ops.push({ type: 'delete_artifact_view', viewId: node.id })
    }
  }

  for (const e of state.edges) {
    const before = previousEdges.get(e.id)
    if (before === undefined || before.from !== e.from || before.to !== e.to || before.kind !== e.kind) {
      ops.push({ type: 'upsert_relation', relation: { id: e.id, projectId, sourceEntityType: 'artifact', sourceEntityId: e.from, targetEntityType: 'artifact', targetEntityId: e.to, kind: e.kind, createdAt: now, updatedAt: now } })
    }
  }
  const edgeIds = new Set(state.edges.map((edge) => edge.id))
  for (const edge of previous.edges) {
    if (!edgeIds.has(edge.id)) ops.push({ type: 'delete_relation', relationId: edge.id, projectId })
  }

  return ops as unknown as MutationBatch['ops']
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneState(state: PersistedPrototypeState): PersistedPrototypeState {
  return structuredClone(state)
}

// ==================== LocalCoreClient extension ====================
