import type { ContextManifestV0, ConversationSessionV1, GraphVersion, PreviewRecord, ProjectGraphSnapshot, Scope, WorkspaceContextPolicy, MutationBatch } from '@local-creative-os/contracts'
import { recallNotePresentation } from '../state/notePresentationMemory'
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
  readonly importedArtifactId?: string
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
      const [resources, conversations] = await Promise.all([
        this.client.resourceList(this.projectId).then((list) => list.result.ok ? list.result.value : []).catch(() => []),
        this.client.conversations(this.projectId).then((list) => list.result.ok ? list.result.value : []).catch(() => []),
      ])
      this.#lastSavedSnapshot = JSON.stringify(snapshot)
      const state = mapGraphToState(snapshot, this.projectId, previews, previewContents, resources, conversations)
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
        ...(entry.lastOpenedAt === undefined ? {} : { lastOpenedAt: String(entry.lastOpenedAt) }),
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
      if (!call.result.ok) return []
      // 同一 revision 可能有历史失败/unsupported 记录（如旧 profile 触发），
      // ready 记录必须覆盖它们，否则真实预览会被 unsupported 遮蔽。
      const rank = (status: string): number => status === 'ready' ? 0 : status === 'failed' ? 1 : 2
      return [...call.result.value].sort((left, right) => rank(String(left.status)) - rank(String(right.status)))
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
            importedArtifactId: String(imported.result.value.artifact.id),
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
  resourceSummaries: readonly { readonly artifactId: string; readonly sourceKind?: string }[] = [],
  conversationSessions: readonly ConversationSessionV1[] = [],
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
  const previewRank = (status: string): number => status === 'ready' ? 0 : status === 'failed' ? 1 : 2
  const previewByRevisionId = new Map<string, (typeof previewRecords)[number]>()
  for (const preview of previewRecords) {
    const existing = previewByRevisionId.get(String(preview.revisionId))
    // 同一 revision 可能同时存在旧 unsupported/failed 与新的 ready 记录；
    // 必须显式选状态最好的那一条，而不是依赖 API 返回顺序。
    if (existing === undefined || previewRank(String(preview.status)) < previewRank(String(existing.status))) {
      previewByRevisionId.set(String(preview.revisionId), preview)
    }
  }
  const sourceKindByArtifact = new Map(resourceSummaries.map((summary) => [String(summary.artifactId), summary.sourceKind]))
  const conversationByViewId = new Map(conversationSessions.flatMap((session) => session.conversationViewId ? [[String(session.conversationViewId), session] as const] : []))
  const childScopeByContainerViewId = new Map(graph.scopes.filter((scope) => scope.containerViewId !== null).map((scope) => [String(scope.containerViewId), String(scope.id)]))
  const childScopeKindByContainerViewId = new Map(graph.scopes.filter((scope) => scope.containerViewId !== null).map((scope) => [String(scope.containerViewId), scope.kind] as const))
  const referenceArtifactIds = new Set(graph.relations.filter((relation) => relation.kind === 'reference' && relation.sourceEntityType === 'artifact').map((relation) => String(relation.sourceEntityId)))
  const feedbackArtifactIds = new Set(graph.relations.filter((relation) => relation.kind === 'feedback' && relation.sourceEntityType === 'artifact').map((relation) => String(relation.sourceEntityId)))
  const artifactByStringId = new Map(graph.artifacts.map((artifact) => [String(artifact.id), artifact] as const))
  const materialSourceByArtifactId = new Map<string, NonNullable<CanvasNode['materialSource']>>()
  for (const relation of graph.relations) {
    if (relation.kind !== 'reference' || relation.createdBy !== 'material-transfer' || relation.sourceEntityType !== 'artifact' || relation.targetEntityType !== 'artifact') continue
    const sourceArtifactId = String(relation.sourceEntityId)
    const targetArtifactId = String(relation.targetEntityId)
    const evidence = relation.evidenceRefs?.find((item) => item.kind === 'artifact' && String(item.id) === targetArtifactId)
    const sourceArtifact = artifactByStringId.get(targetArtifactId)
    materialSourceByArtifactId.set(sourceArtifactId, {
      artifactId: targetArtifactId,
      ...(primaryViewByArtifactId.get(targetArtifactId) ? { viewId: primaryViewByArtifactId.get(targetArtifactId) } : {}),
      ...(evidence?.revisionId ? { revisionId: evidence.revisionId } : {}),
      ...(evidence?.sourceAnchor ? { sourceAnchor: evidence.sourceAnchor } : {}),
      ...(evidence?.label || sourceArtifact?.title ? { title: evidence?.label || sourceArtifact?.title } : {}),
    })
  }

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
    const conversation = conversationByViewId.get(String(view.id))
    const materialSource = artifact === undefined ? undefined : materialSourceByArtifactId.get(String(artifact.id))
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
      ...(conversation ? {
        entityKind: 'conversation' as const,
        conversation: {
          id: String(conversation.id),
          title: conversation.title,
          messageCount: conversation.messageCount,
          updatedAt: conversation.updatedAt,
          lastOpenedAt: conversation.lastOpenedAt,
          lastRunAt: conversation.lastRunAt,
          lastSelectedAsControllerAt: conversation.lastSelectedAsControllerAt,
          ...(conversation.conversationArtifactId ? { conversationArtifactId: String(conversation.conversationArtifactId) } : {}),
        },
      } : {}),
      fileRecordId: revision === undefined ? undefined : String(revision.fileRecordId),
      fileAvailability: fileRecord?.availability,
      contentHash: revision === undefined ? undefined : String(revision.contentHash),
      observedPath: fileRecord?.observedPath,
      sourceKind: artifact === undefined ? undefined : sourceKindByArtifact.get(String(artifact.id)),
      ...(materialSource ? { materialSource } : {}),
      followsCurrentRevision: artifact?.currentRevisionId !== undefined && revisionId === artifact.currentRevisionId,
      previewStatus: preview?.status ?? 'not-generated',
      previewProfile: preview?.previewProfile,
      previewRenderer: preview === undefined ? undefined : `${preview.rendererId}@${preview.rendererVersion}`,
      previewError: preview?.errorMessage,
      previewMimeType: preview?.mimeType,
      previewDataUrl: previewContent === undefined ? undefined : `data:${previewContent.mimeType};base64,${previewContent.data}`,
      previewText: previewContent === undefined || !previewContent.mimeType.startsWith('text/') ? undefined : decodeBase64Text(previewContent.data),
      // 统一文本编辑：text artifact 也走 note 编辑体系（noteBody / 导图布局随会话记忆恢复）。
      ...(() => {
        const presentation = recallNotePresentation(String(view.id))
        return {
          ...(presentation.noteBody !== undefined ? { noteBody: presentation.noteBody } : {}),
          ...(presentation.noteLayout ? { noteLayout: presentation.noteLayout } : {}),
          ...(presentation.noteOutline ? { noteOutline: presentation.noteOutline } : {}),
          ...(presentation.noteTags ? { noteTags: presentation.noteTags } : {}),
        }
      })(),
      scopeId: normalizeScopeId(view.scopeId),
      opensScopeId: childScopeByContainerViewId.get(String(view.id)),
      entityKind: (() => {
        const kind = childScopeKindByContainerViewId.get(String(view.id))
        return kind === 'workflow' ? 'workflow' : kind === 'context' ? 'context' : kind === 'collection' ? 'collection' : undefined
      })(),
    }
  })

  // GUI-6：Core Note 投影为锚定备注节点（只读投影，不参与 Artifact 持久化）。
  // Note 实体本身没有画布坐标：位置由锚点目标推导；锚点不可解析时用确定性兜底。
  const nodeByArtifactId = new Map<string, CanvasNode>()
  const nodeByRevisionId = new Map<string, CanvasNode>()
  for (const node of nodes) {
    if (node.artifactId !== undefined) nodeByArtifactId.set(node.artifactId, node)
    if (node.revisionId !== undefined) nodeByRevisionId.set(node.revisionId, node)
  }
  const maxContentRight = nodes.reduce((max, node) => Math.max(max, node.x + node.width), 0)
  const NOTE_NODE_HEIGHT = 120
  const rectCollides = (x: number, y: number, width: number, height: number): boolean =>
    nodes.some((node) => x < node.x + node.width && node.x < x + width && y < node.y + node.height && node.y < y + height)
  const noteEdges: CanvasEdge[] = []
  const noteNodes: CanvasNode[] = graph.notes.map((note, index) => {
    const anchor = note.anchor
    const anchorTarget = anchor.type === 'artifact_view'
      ? nodes.find((node) => node.id === String(anchor.viewId))
      : anchor.type === 'artifact'
        ? nodeByArtifactId.get(String(anchor.artifactId))
        : anchor.type === 'page'
          ? nodeByRevisionId.get(String(anchor.revisionId))
          : anchor.type === 'scope'
            ? (() => {
                const scope = graph.scopes.find((item) => String(item.id) === String(anchor.scopeId))
                const containerViewId = scope === undefined ? undefined : childScopeByContainerViewId.get(String(scope.id))
                return containerViewId === undefined ? undefined : nodes.find((node) => node.id === containerViewId)
              })()
            : undefined
    const scopeId = anchorTarget?.scopeId
      ?? (anchor.type === 'scope' ? normalizeScopeId(anchor.scopeId) : undefined)
      ?? normalizeScopeId(undefined)
    const lines = note.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const title = (lines[0] ?? '文本').slice(0, 60)
    const bodyTail = lines.slice(1).join(' ').trim().slice(0, 24)
    const belowTarget = anchorTarget === undefined ? undefined : { x: anchorTarget.x + 24, y: anchorTarget.y + anchorTarget.height + 24 }
    const position = belowTarget !== undefined && !rectCollides(belowTarget.x, belowTarget.y, 232, NOTE_NODE_HEIGHT)
      ? belowTarget
      : { x: maxContentRight + 28, y: 48 + index * 140 }
    if (anchorTarget !== undefined) {
      noteEdges.push({
        id: `note-edge-${String(note.id)}`,
        from: String(note.id),
        to: anchorTarget.id,
        kind: 'reference',
        scope: 'presentation',
        origin: 'system',
      })
    }
    const viewId = String(note.id)
    const presentation = recallNotePresentation(viewId)
    return {
      id: viewId,
      kind: 'note' as const,
      title,
      // Unified text nodes: subtitle is the first body line, same as any other note.
      subtitle: bodyTail,
      x: position.x, y: position.y,
      width: 232, height: NOTE_NODE_HEIGHT,
      displayMode: presentation.noteLayout === 'mindmap' ? 'expanded' as const : 'standard' as const,
      scopeId,
      noteBody: note.body,
      anchors: [anchor],
      createdAt: note.createdAt,
      ...(presentation.noteLayout ? { noteLayout: presentation.noteLayout } : {}),
      ...(presentation.noteOutline ? { noteOutline: presentation.noteOutline } : {}),
      ...(presentation.noteTags ? { noteTags: presentation.noteTags } : {}),
    }
  })

  const scopeContainerViewById = new Map(graph.scopes
    .filter((scope) => scope.containerViewId !== null)
    .map((scope) => [String(scope.id), String(scope.containerViewId)] as const))
  const endpointId = (entityType: string, entityId: string): string => entityType === 'workspace'
    ? `workspace:${entityId}`
    : entityType === 'scope'
      ? (scopeContainerViewById.get(String(entityId)) ?? `scope:${entityId}`)
      : entityType === 'view'
        ? String(entityId)
        : primaryViewByArtifactId.get(String(entityId)) ?? String(entityId)
  const HIERARCHY_RELATION_KINDS = new Set([
    '包含', '归组', '来源于', '层级', '父子', '父', '子', '上级', '下级',
    'hierarchy', 'parent', 'child', 'contains', 'part-of', 'source-of', 'derived-from',
  ])
  const edges: CanvasEdge[] = [...graph.relations.map((rel) => ({
    id: String(rel.id),
    from: endpointId(rel.sourceEntityType, rel.sourceEntityId),
    to: endpointId(rel.targetEntityType, rel.targetEntityId),
    kind: HIERARCHY_RELATION_KINDS.has(String(rel.kind))
      ? 'hierarchy' as const
      : rel.kind === 'feedback' ? 'feedback' as const
      : (rel.kind === 'informs' || rel.kind === 'reference') ? 'reference' as const
      : 'modify' as const,
    active: false,
    scope: 'domain' as const,
    label: String(rel.kind),
  })), ...noteEdges]

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
    version: 10, projectId, nodes: [...nodes, ...noteNodes], edges,
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
    // Scope is only a navigation/presentation shell. Persist its container
    // View identity so aggregate Project nodes (Collection/Context containers)
    // survive reload. The container does not own the scope's semantic members.
    containerViewId: (s.containerNodeId ?? null) as ProjectGraphSnapshot['scopes'][number]['containerViewId'],
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

  // DEPRECATED_BEHAVIORAL_HINT (Phase A): filtering by node kind
  // (process/note/decision) is a legacy heuristic; Presentation membership
  // must not be derived from these kinds in new code.
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
  const aggregateScopeByNodeId = new Map(state.nodes.flatMap((node) => node.opensScopeId && (node.entityKind === 'collection' || node.entityKind === 'context' || node.entityKind === 'workflow')
    ? [[node.id, node.opensScopeId] as const]
    : []))
  const relationEndpoint = (id: string): { type: 'artifact' | 'workspace' | 'scope'; id: string } => id.startsWith('workspace:')
    ? { type: 'workspace' as const, id: id.slice('workspace:'.length) }
    : id.startsWith('scope:')
      ? { type: 'scope' as const, id: id.slice('scope:'.length) }
      : aggregateScopeByNodeId.has(id)
        ? { type: 'scope' as const, id: aggregateScopeByNodeId.get(id)! }
        : { type: 'artifact' as const, id }
  const isDurableEndpoint = (id: string): boolean => coreNodeIds.has(id) || id.startsWith('workspace:') || id.startsWith('scope:') || aggregateScopeByNodeId.has(id)
  const relations: ProjectGraphSnapshot['relations'] = state.edges
    .filter((edge) => isDurableEndpoint(edge.from) && isDurableEndpoint(edge.to))
    .map((e) => ({
      id: e.id as ProjectGraphSnapshot['relations'][number]['id'],
      projectId: projectId as ProjectGraphSnapshot['relations'][number]['projectId'],
      sourceEntityType: relationEndpoint(e.from).type,
      sourceEntityId: relationEndpoint(e.from).id as ProjectGraphSnapshot['relations'][number]['sourceEntityId'],
      targetEntityType: relationEndpoint(e.to).type,
      targetEntityId: relationEndpoint(e.to).id as ProjectGraphSnapshot['relations'][number]['targetEntityId'],
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
    if (before === undefined || before.label !== s.label || before.kind !== s.kind || before.parentScopeId !== s.parentScopeId || before.containerNodeId !== s.containerNodeId) {
      ops.push({ type: 'upsert_scope', scope: { id: s.id, projectId, parentScopeId: s.parentScopeId ?? null, containerViewId: s.containerNodeId ?? null, kind: s.kind || 'root', name: s.label, createdAt: now, updatedAt: now } })
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
  const stateWorkspaceIds = state.workspaces.map((workspace) => workspace.id)
  const previousWorkspaceIds = previous.workspaces.map((workspace) => workspace.id)
  for (const workspace of previous.workspaces) {
    if (!state.workspaces.some((ws) => ws.id === workspace.id)) {
      ops.push({ type: 'delete_workspace', workspaceId: workspace.id })
    }
  }
  const previousWorkspaceSet = new Set(previousWorkspaceIds)
  const sameWorkspaceSet = stateWorkspaceIds.length === previousWorkspaceIds.length
    && stateWorkspaceIds.every((id) => previousWorkspaceSet.has(id))
  if (sameWorkspaceSet && stateWorkspaceIds.length > 0
    && stateWorkspaceIds.some((id, index) => id !== previousWorkspaceIds[index])) {
    ops.push({ type: 'reorder_workspaces', workspaceIds: stateWorkspaceIds })
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
  const aggregateScopeByNodeId = new Map(state.nodes.flatMap((node) => node.opensScopeId && (node.entityKind === 'collection' || node.entityKind === 'context' || node.entityKind === 'workflow')
    ? [[node.id, node.opensScopeId] as const]
    : []))
  const relationEndpoint = (id: string): { type: 'artifact' | 'workspace' | 'scope'; id: string } => id.startsWith('workspace:')
    ? { type: 'workspace' as const, id: id.slice('workspace:'.length) }
    : id.startsWith('scope:')
      ? { type: 'scope' as const, id: id.slice('scope:'.length) }
      : aggregateScopeByNodeId.has(id)
        ? { type: 'scope' as const, id: aggregateScopeByNodeId.get(id)! }
        : { type: 'artifact' as const, id }
  const isDurableEndpoint = (id: string): boolean => durableNodeIds.has(id) || id.startsWith('workspace:') || id.startsWith('scope:') || aggregateScopeByNodeId.has(id)
  const durableEdges = state.edges.filter((edge) => isDurableEndpoint(edge.from) && isDurableEndpoint(edge.to))
  const previousDurableNodeIds = new Set(previous.nodes
    .filter((node) => !node.runtimeTransient && node.kind !== 'process' && node.kind !== 'note' && node.kind !== 'decision')
    .map((node) => node.id))
  const previousAggregateScopeNodeIds = new Set(previous.nodes.filter((node) => node.opensScopeId && (node.entityKind === 'collection' || node.entityKind === 'context' || node.entityKind === 'workflow')).map((node) => node.id))
  const previousDurableEdges = previous.edges.filter((edge) =>
    (previousDurableNodeIds.has(edge.from) || edge.from.startsWith('workspace:') || edge.from.startsWith('scope:') || previousAggregateScopeNodeIds.has(edge.from))
    && (previousDurableNodeIds.has(edge.to) || edge.to.startsWith('workspace:') || edge.to.startsWith('scope:') || previousAggregateScopeNodeIds.has(edge.to)))
  for (const e of durableEdges) {
    const before = previousEdges.get(e.id)
    if (before === undefined || before.from !== e.from || before.to !== e.to || before.kind !== e.kind) {
      ops.push({ type: 'upsert_relation', relation: { id: e.id, projectId, sourceEntityType: relationEndpoint(e.from).type, sourceEntityId: relationEndpoint(e.from).id, targetEntityType: relationEndpoint(e.to).type, targetEntityId: relationEndpoint(e.to).id, kind: e.kind, createdAt: now, updatedAt: now } })
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
