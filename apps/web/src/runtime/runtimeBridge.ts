import type { ContextManifestV0, GraphVersion, PreviewRecord, ProjectGraphSnapshot, Scope, WorkspaceContextPolicy, MutationBatch } from '@local-creative-os/contracts'
import type {
  CanvasEdge,
  CanvasNode,
  CanvasScope,
  PersistedPrototypeState,
  ProjectPackage,
  WorkRailPreferences,
  Workspace,
} from '../model'
import { createLocalCoreClient, type LocalCoreClient, type PreviewContentResult } from './localCoreClient'

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

export interface PreviewGenerateResult {
  readonly state: PersistedPrototypeState | null
  readonly error?: string
}

export interface ImportCopyBridgeResult {
  readonly state: PersistedPrototypeState | null
  readonly importedViewId?: string
  readonly importedRevisionId?: string
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
      const previews = await this.#loadPreviewRecords()
      const previewContents = await this.#loadPreviewContents(previews)
      this.#lastSavedSnapshot = JSON.stringify(snapshot)
      const state = mapGraphToState(snapshot, this.projectId, previews, previewContents)
      this.#graphVersion = Number(snapshot.graphVersion) || 1
      this.#acknowledgedState = cloneState(state)
      return { source: 'runtime', state }
    } catch (err) {
      return { source: 'none', state: null, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /** B4 — Core 收口的 Workbench Merge；成功后重载 Project Truth。 */
  async mergeWorkbench(workbenchScopeId: string): Promise<{ ok: boolean; error?: string; result?: { mergedViews: number; restoredRefs: number; removedViews: number }; state?: PersistedPrototypeState }> {
    const call = await this.client.mergeWorkbench(this.projectId, workbenchScopeId)
    if (!call.result.ok) return { ok: false, error: call.result.error.message }
    const reload = await this.loadProject()
    if (reload.source !== 'runtime' || reload.state === null) return { ok: false, error: reload.error ?? 'Reload after merge failed.' }
    return { ok: true, result: call.result.value, state: reload.state }
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

  async #loadPreviewRecords(): Promise<readonly PreviewRecord[]> {
    try {
      const call = await this.client.previewRecords(this.projectId)
      return call.result.ok ? call.result.value : []
    } catch {
      return []
    }
  }

  async #loadPreviewContents(previews: readonly PreviewRecord[]): Promise<ReadonlyMap<string, PreviewContentResult>> {
    const readyPreviews = previews.filter((preview) => preview.status === 'ready')
    const entries = await Promise.all(readyPreviews.map(async (preview) => {
      try {
        const call = await this.client.previewContent(this.projectId, String(preview.id))
        return call.result.ok ? [String(preview.id), call.result.value] as const : null
      } catch {
        return null
      }
    }))
    return new Map(entries.filter((entry): entry is readonly [string, PreviewContentResult] => entry !== null))
  }

  async generatePreview(revisionId: string, previewProfile = 'thumbnail'): Promise<PreviewGenerateResult> {
    try {
      const generated = await this.client.generatePreview(this.projectId, revisionId, previewProfile)
      if (!generated.result.ok) return { state: null, error: generated.result.error.message }
      const loaded = await this.loadProject()
      return loaded.state === null ? { state: null, error: loaded.error } : { state: loaded.state }
    } catch (err) {
      return { state: null, error: err instanceof Error ? err.message : 'Preview generation failed.' }
    }
  }

  async importCopy(input: { readonly file: File; readonly importRequestId: string; readonly scopeId: string; readonly x: number; readonly y: number }): Promise<ImportCopyBridgeResult> {
    try {
      const imported = await this.client.importCopy(this.projectId, input)
      if (!imported.result.ok) return { state: null, error: imported.result.error.message }
      const loaded = await this.loadProject()
      return loaded.state === null
        ? { state: null, error: loaded.error }
        : {
            state: loaded.state,
            importedViewId: String(imported.result.value.view.id),
            importedRevisionId: String(imported.result.value.revision.id),
          }
    } catch (err) {
      return { state: null, error: err instanceof Error ? err.message : 'Import Copy failed.' }
    }
  }

  async buildContextManifest(input: { readonly targetArtifactId?: string; readonly requestedOutput?: string } = {}): Promise<{ readonly manifest: ContextManifestV0 | null; readonly error?: string }> {
    try {
      const call = await this.client.buildContextManifest(this.projectId, input)
      return call.result.ok
        ? { manifest: call.result.value }
        : { manifest: null, error: call.result.error.message }
    } catch (err) {
      return { manifest: null, error: err instanceof Error ? err.message : 'Context Manifest failed.' }
    }
  }

  async refreshFileRecord(fileRecordId: string): Promise<PreviewGenerateResult> {
    try {
      const refreshed = await this.client.refreshFileRecord(fileRecordId)
      if (!refreshed.result.ok) return { state: null, error: refreshed.result.error.message }
      const loaded = await this.loadProject()
      return loaded.state === null ? { state: null, error: loaded.error } : { state: loaded.state }
    } catch (err) {
      return { state: null, error: err instanceof Error ? err.message : 'File refresh failed.' }
    }
  }

  async adoptExternalChange(fileRecordId: string): Promise<PreviewGenerateResult> {
    try {
      const adopted = await this.client.adoptExternalChange(fileRecordId)
      if (!adopted.result.ok) return { state: null, error: adopted.result.error.message }
      const loaded = await this.loadProject()
      return loaded.state === null ? { state: null, error: loaded.error } : { state: loaded.state }
    } catch (err) {
      return { state: null, error: err instanceof Error ? err.message : 'External change adoption failed.' }
    }
  }
}

// ==================== GraphSnapshot → AppState ====================

const KIND_TO_NODE: Record<string, CanvasNode['kind']> = {
  markdown: 'source', image: 'source', presentation: 'source', pdf: 'source', other: 'context',
}

export function mapGraphToState(
  graph: ProjectGraphSnapshot,
  projectId: string,
  previewRecords: readonly PreviewRecord[] = [],
  previewContents: ReadonlyMap<string, PreviewContentResult> = new Map(),
): PersistedPrototypeState {
  const declaredScopeIds = new Set(graph.scopes.map((scope) => String(scope.id)))
  const canonicalRootScopeId = String(graph.scopes.find((scope) => scope.kind === 'root')?.id ?? graph.scopes[0]?.id ?? 'scope-root')
  const normalizeScopeId = (scopeId: unknown): string => {
    const value = String(scopeId)
    return declaredScopeIds.has(value) ? value : canonicalRootScopeId
  }
  const artifactById = new Map(graph.artifacts.map((a) => [a.id, a]))
  const primaryViewByArtifactId = new Map(
    [...graph.artifactViews]
      .sort((left, right) => String(left.id).localeCompare(String(right.id), 'en-US'))
      .map((view) => [String(view.artifactId), String(view.id)] as const),
  )
  const revisionById = new Map(graph.artifactRevisions.map((revision) => [revision.id, revision]))
  const revisionsByArtifactId = new Map<string, ProjectGraphSnapshot['artifactRevisions'][number][]>()
  graph.artifactRevisions.forEach((revision) => {
    const key = String(revision.artifactId)
    const list = revisionsByArtifactId.get(key) ?? []
    list.push(revision)
    revisionsByArtifactId.set(key, list)
  })
  revisionsByArtifactId.forEach((list) => list.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))))
  const fileRecordById = new Map(graph.fileRecords.map((fileRecord) => [fileRecord.id, fileRecord]))
  const previewByRevisionId = new Map(previewRecords.map((preview) => [preview.revisionId, preview]))
  const childScopeByContainerViewId = new Map(graph.scopes.filter((scope) => scope.containerViewId !== null).map((scope) => [String(scope.containerViewId), String(scope.id)]))
  const referenceArtifactIds = new Set(graph.relations.filter((relation) => relation.kind === 'reference' && relation.sourceEntityType === 'artifact').map((relation) => String(relation.sourceEntityId)))
  const feedbackArtifactIds = new Set(graph.relations.filter((relation) => relation.kind === 'feedback' && relation.sourceEntityType === 'artifact').map((relation) => String(relation.sourceEntityId)))

  const nodes: CanvasNode[] = graph.artifactViews.map((view) => {
    const artifact = artifactById.get(view.artifactId)
    const revisionId = view.referenceKind === 'primary'
      ? artifact?.currentRevisionId ?? view.revisionId
      : view.revisionId ?? artifact?.currentRevisionId
    const revision = revisionId === undefined ? undefined : revisionById.get(revisionId)
    const fileRecord = revision === undefined ? undefined : fileRecordById.get(revision.fileRecordId)
    const preview = revisionId === undefined ? undefined : previewByRevisionId.get(revisionId)
    const previewContent = preview === undefined ? undefined : previewContents.get(String(preview.id))
    const isStale = artifact?.availability === 'stale'
    const isMissing = artifact?.availability === 'missing'
    const artifactRevisions = artifact === undefined ? [] : (revisionsByArtifactId.get(String(artifact.id)) ?? [])
    const revisionIndex = revisionId === undefined ? -1 : artifactRevisions.findIndex((item) => String(item.id) === String(revisionId))
    const historical = Boolean(revisionId && artifact?.currentRevisionId && String(revisionId) !== String(artifact.currentRevisionId))
    const runtimeRole = artifact === undefined
      ? undefined
      : feedbackArtifactIds.has(String(artifact.id))
        ? 'feedback'
        : referenceArtifactIds.has(String(artifact.id))
          ? 'reference'
          : undefined
    return {
      id: String(view.id),
      kind: runtimeRole === 'feedback' ? 'note' : artifact ? (KIND_TO_NODE[artifact.kind] ?? 'source') : 'source',
      title: artifact?.title ?? String(view.id),
      subtitle: artifact?.kind ? `${runtimeRole === 'feedback' ? 'Feedback' : runtimeRole === 'reference' ? 'External Reference' : artifact.kind}${fileRecord ? ' · Runtime source' : ''}${fileRecord && (artifact.kind === 'pdf' || artifact.kind === 'presentation') ? ' · 只读预览可用' : ''}` : '',
      contextOnly: runtimeRole === 'reference' || artifact?.managed !== true,
      x: view.position.x, y: view.position.y,
      width: view.size.width, height: view.size.height,
      displayMode: view.displayMode === 'compact' ? 'compact' as const : 'standard' as const,
      draft: isStale, current: !isStale, disabled: isMissing,
      fileType: artifact?.kind,
      artifactId: artifact === undefined ? undefined : String(artifact.id),
      revisionId: revisionId === undefined ? undefined : String(revisionId),
      revisionCount: artifactRevisions.length,
      revisionLabel: revisionIndex >= 0 ? `V${revisionIndex + 1}` : undefined,
      historical,
      managed: artifact?.managed ?? false,
      createdAt: revision?.createdAt ?? artifact?.createdAt,
      sourceRunId: revision?.runId === undefined ? undefined : String(revision.runId),
      fileRecordId: revision === undefined ? undefined : String(revision.fileRecordId),
      fileAvailability: fileRecord?.availability,
      contentHash: revision === undefined ? undefined : String(revision.contentHash),
      observedPath: fileRecord?.observedPath,
      followsCurrentRevision: artifact?.currentRevisionId !== undefined && revisionId === artifact.currentRevisionId,
      previewStatus: preview?.status ?? 'not-generated',
      previewProfile: preview?.previewProfile,
      previewRenderer: preview === undefined ? undefined : `${preview.rendererId}@${preview.rendererVersion}`,
      previewError: preview?.errorMessage,
      previewMimeType: preview?.mimeType,
      previewDataUrl: previewContent === undefined ? undefined : `data:${previewContent.mimeType};base64,${previewContent.data}`,
      previewText: previewContent === undefined || !previewContent.mimeType.startsWith('text/') ? undefined : decodeBase64Text(previewContent.data),
      scopeId: normalizeScopeId(view.scopeId),
      opensScopeId: childScopeByContainerViewId.get(String(view.id)),
    }
  })

  const edges: CanvasEdge[] = graph.relations.map((rel) => ({
    id: String(rel.id),
    from: primaryViewByArtifactId.get(String(rel.sourceEntityId)) ?? String(rel.sourceEntityId),
    to: primaryViewByArtifactId.get(String(rel.targetEntityId)) ?? String(rel.targetEntityId),
    kind: rel.kind === 'feedback' ? 'feedback' as const : (rel.kind === 'informs' || rel.kind === 'reference') ? 'reference' as const : 'modify' as const,
    active: false,
  }))

  // Workspaces from snapshot
  const workspaces: Workspace[] = graph.workspaces.map((ws) => ({
    id: String(ws.id),
    label: ws.name,
    intent: (ws.intent ?? null) as Workspace['intent'],
    scopeId: normalizeScopeId(ws.scopeId),
    camera: { x: ws.viewport.x, y: ws.viewport.y, zoom: ws.viewport.zoom },
    visibleLayers: (ws.visibleLayers as Workspace['visibleLayers']) ?? ['core', 'process'],
    focusedViewIds: ws.focusedViewIds.map(String),
    contextPolicy: (ws.contextPolicy ?? 'selection-only') as Workspace['contextPolicy'],
    ...(ws.frameBounds === undefined ? {} : { frameBounds: { x: ws.frameBounds.x, y: ws.frameBounds.y, width: ws.frameBounds.width, height: ws.frameBounds.height } }),
    ...(ws.preferredSurface === undefined ? {} : { preferredSurface: ws.preferredSurface }),
    ...(ws.version === undefined ? {} : { version: ws.version }),
    createdAt: ws.updatedAt, updatedAt: ws.updatedAt,
  }))

  // Scopes from snapshot
  const scopes: CanvasScope[] = graph.scopes.length > 0
    ? graph.scopes.map((s: Scope) => ({
        id: String(s.id), label: s.name,
        kind: s.kind as CanvasScope['kind'],
        parentScopeId: s.parentScopeId ? normalizeScopeId(s.parentScopeId) : null,
        containerNodeId: s.containerViewId === null ? undefined : String(s.containerViewId),
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

function decodeBase64Text(value: string): string | undefined {
  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return undefined
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
    ...(ws.frameBounds === undefined ? {} : { frameBounds: ws.frameBounds }),
    ...(ws.preferredSurface === undefined ? {} : { preferredSurface: ws.preferredSurface }),
    ...(ws.version === undefined ? {} : { version: ws.version }),
    updatedAt: now,
  }))

  // Artifacts + ArtifactViews from core nodes (filter out process/note/decision)
  const coreNodes = state.nodes.filter((n) => !n.runtimeTransient && n.kind !== 'process' && n.kind !== 'note' && n.kind !== 'decision')
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

  // Relations: only persist edges between durable content objects.
  // Run / process projection edges are presentation-only and come from the backend.
  const coreNodeIds = new Set(coreNodes.map((node) => node.id))
  const relations: ProjectGraphSnapshot['relations'] = state.edges
    .filter((edge) => coreNodeIds.has(edge.from) && coreNodeIds.has(edge.to))
    .map((e) => ({
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
      ...(ws.frameBounds === undefined ? {} : { frameBounds: ws.frameBounds }),
      ...(ws.preferredSurface === undefined ? {} : { preferredSurface: ws.preferredSurface }),
      ...(ws.version === undefined ? {} : { version: ws.version }),
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
    if (!sameValue(before.frameBounds, ws.frameBounds) || before.preferredSurface !== ws.preferredSurface) {
      ops.push({
        type: 'update_workspace_frame',
        workspaceId: ws.id,
        ...(ws.frameBounds === undefined ? {} : { frameBounds: ws.frameBounds }),
        ...(ws.preferredSurface === undefined ? {} : { preferredSurface: ws.preferredSurface }),
        expectedVersion: before.version ?? 0,
      })
    }
  }

  const coreNodes = state.nodes.filter(n => !n.runtimeTransient && n.kind !== 'process' && n.kind !== 'note' && n.kind !== 'decision')
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

  const durableNodeIds = new Set(coreNodes.map((node) => node.id))
  const durableEdges = state.edges.filter((edge) => durableNodeIds.has(edge.from) && durableNodeIds.has(edge.to))
  const previousDurableNodeIds = new Set(previous.nodes
    .filter((node) => !node.runtimeTransient && node.kind !== 'process' && node.kind !== 'note' && node.kind !== 'decision')
    .map((node) => node.id))
  const previousDurableEdges = previous.edges.filter((edge) => previousDurableNodeIds.has(edge.from) && previousDurableNodeIds.has(edge.to))
  for (const e of durableEdges) {
    const before = previousEdges.get(e.id)
    if (before === undefined || before.from !== e.from || before.to !== e.to || before.kind !== e.kind) {
      ops.push({ type: 'upsert_relation', relation: { id: e.id, projectId, sourceEntityType: 'artifact', sourceEntityId: e.from, targetEntityType: 'artifact', targetEntityId: e.to, kind: e.kind, createdAt: now, updatedAt: now } })
    }
  }
  const edgeIds = new Set(durableEdges.map((edge) => edge.id))
  for (const edge of previousDurableEdges) {
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
