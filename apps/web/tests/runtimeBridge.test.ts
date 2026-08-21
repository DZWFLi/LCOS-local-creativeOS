import type {
  GraphVersion,
  MutationBatch,
  MutationResult,
  ProjectGraphSnapshot,
} from '@local-creative-os/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { PersistedPrototypeState } from '../src/model'
import type { LocalCoreClient, RuntimeCall } from '../src/runtime/localCoreClient'
import { diffStateToOps, mapGraphToState, mapStateToGraph, RuntimeBridge } from '../src/runtime/runtimeBridge'

const NOW = '2026-07-26T00:00:00.000Z'

function state(title = 'Brief'): PersistedPrototypeState {
  return {
    version: 9,
    projectId: 'disposable-portasplit',
    nodes: [{
      id: 'brief', kind: 'source', title, subtitle: 'markdown',
      x: 10, y: 20, width: 200, height: 140, scopeId: 'scope-root',
    }],
    edges: [],
    workspaces: [{
      id: 'workspace-main', label: 'Main', intent: 'build', scopeId: 'scope-root',
      camera: { x: 0, y: 0, zoom: 1 }, visibleLayers: ['core'],
      focusedViewIds: ['brief'], contextPolicy: 'selection-only',
      createdAt: NOW, updatedAt: NOW,
    }],
    scopes: [{
      id: 'scope-root', label: 'Root', kind: 'root', parentScopeId: null,
      camera: { x: 0, y: 0, zoom: 1 },
    }],
    activeWorkspaceId: 'workspace-main',
    activeScopeId: 'scope-root',
    workRail: { pinned: true, collapsed: false, width: 350 },
  }
}

function snapshot(title = 'Brief', graphVersion = 1): ProjectGraphSnapshot {
  const current = state(title)
  return {
    schemaVersion: 3,
    graphVersion: graphVersion as GraphVersion,
    project: {
      id: 'disposable-portasplit' as ProjectGraphSnapshot['project']['id'],
      name: 'PortaSplit',
      rootPath: 'disposable://portasplit',
      graphVersion: graphVersion as GraphVersion,
      createdAt: NOW,
      updatedAt: NOW,
    },
    scopes: [{
      id: 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id'],
      projectId: 'disposable-portasplit' as ProjectGraphSnapshot['project']['id'],
      parentScopeId: null,
      containerViewId: null,
      kind: 'root',
      name: 'Root',
      createdAt: NOW,
      updatedAt: NOW,
    }],
    workspaces: [{
      id: 'workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id'],
      projectId: 'disposable-portasplit' as ProjectGraphSnapshot['project']['id'],
      scopeId: 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id'],
      name: 'Main',
      intent: 'build',
      viewport: current.workspaces[0].camera,
      focusedViewIds: ['brief' as ProjectGraphSnapshot['artifactViews'][number]['id']],
      visibleLayers: ['core'],
      contextPolicy: 'selection-only',
      updatedAt: NOW,
    }],
    artifacts: [{
      id: 'brief' as ProjectGraphSnapshot['artifacts'][number]['id'],
      projectId: 'disposable-portasplit' as ProjectGraphSnapshot['project']['id'],
      title,
      kind: 'markdown',
      availability: 'available',
      createdAt: NOW,
      updatedAt: NOW,
    }],
    artifactViews: [{
      id: 'brief' as ProjectGraphSnapshot['artifactViews'][number]['id'],
      artifactId: 'brief' as ProjectGraphSnapshot['artifacts'][number]['id'],
      scopeId: 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id'],
      referenceKind: 'primary',
      position: { x: 10, y: 20 },
      size: { width: 200, height: 140 },
      displayMode: 'card',
      collapsed: false,
    }],
    relations: [],
    notes: [],
    fileRecords: [],
    artifactRevisions: [],
    checkpoints: [],
  }
}

function call<Value>(value: Value): RuntimeCall<Value> {
  return {
    result: { ok: true, value },
    origin: 'runtime',
    latencyMs: 0,
    requestedAt: NOW,
  }
}

function mockClient(overrides: Partial<LocalCoreClient> = {}): LocalCoreClient {
  const unavailable = async (): Promise<never> => {
    throw new Error('Unexpected client call')
  }
  return {
    health: unavailable,
    catalog: unavailable,
    runtimeRegistry: unavailable,
    runtimeFocusProject: unavailable,
    setPinnedCaptureProject: unavailable,
    revealProject: unavailable,
    updateEntityTitle: unavailable,
    projectSearch: unavailable,
    localIntelligence: unavailable,
    attentionRuntime: unavailable,
    setAttentionIntent: unavailable,
    dismissContinuityCandidate: unavailable,
    captureStaging: unavailable,
    createProjectFromStaging: unavailable,
    ocr: unavailable,
    viewRailOrder: unavailable,
    saveViewRailOrder: unavailable,
    affinityResolve: unavailable,
    continuityResolve: unavailable,
    continuityResume: unavailable,
    bindContinuitySession: unavailable,
    continuityAttach: unavailable,
    continuityReturn: unavailable,
    resolveCaptureStaging: unavailable,
    validateProjectRoot: unavailable,
    selectDirectory: unavailable,
    inspectProjectRoot: unavailable,
    createProject: unavailable,
    importResourceUrl: unavailable,
    resourceList: unavailable,
    resourceDescriptor: unavailable,
    resourceReanalyze: unavailable,
    resourceRead: unavailable,
    importResourceDirectory: unavailable,
    importResourceArchive: unavailable,
    selectObsidianVault: unavailable,
    importObsidianNotes: unavailable,
    metadataStatus: unavailable,
    projectGraph: vi.fn(async () => call(snapshot())),
    deleteProject: vi.fn(async () => call({ deleted: true, projectId: 'disposable-portasplit' })),
    mergeWorkbench: vi.fn(async () => call({ mergedViews: 0, restoredRefs: 0, removedViews: 0 })),
    createTextArtifact: unavailable,
    exportLcosproj: unavailable,
    exportAllLcosproj: unavailable,
    openLcosproj: unavailable,
    downloadHandoffZip: unavailable,
    exportWorkflow: unavailable,
    importWorkflow: unavailable,
    inspectLcosproj: unavailable,
    downloadLcosproj: unavailable,
    openLcosprojUpload: unavailable,
    workspaceMemberships: unavailable,
    addWorkspaceMembers: unavailable,
    removeWorkspaceMember: unavailable,
    moveWorkspaceMember: unavailable,
    validateAgentPlan: unavailable,
    proposeRun: unavailable,
    runtimeProviders: unavailable,
    artifactSearch: unavailable,
    artifactDetail: unavailable,
    revisionList: unavailable,
    openArtifactSource: unavailable,
    revealArtifactSource: unavailable,
    artifactSourcePath: unavailable,
    relinkArtifactSource: unavailable,
    resolveArtifactShortcut: unavailable,
    revisionCompare: unavailable,
    processProjection: unavailable,
    saveWorkspaceState: unavailable,
    listWorkspaceStates: unavailable,
    restoreWorkspaceState: unavailable,
    createSessionSummary: unavailable,
    listSessionSummaries: unavailable,
    createCheckpoint: unavailable,
    updateActiveContext: unavailable,
    activeContext: unavailable,
    streamActiveContext: unavailable,
    getCommandDraft: unavailable,
    saveCommandDraft: unavailable,
    deleteCommandDraft: unavailable,
    getProviderSession: unavailable,
    saveProviderSession: unavailable,
    deleteProviderSession: unavailable,
    proposeContextChange: unavailable,
    acceptContextProposal: unavailable,
    rejectContextProposal: unavailable,
    listContextProposals: unavailable,
    previewRecords: vi.fn(async () => call([])),
    previewContent: unavailable,
    generatePreview: unavailable,
    importCopy: unavailable,
    buildContextManifest: unavailable,
    createRuntimeRun: unavailable,
    projectRunReviews: unavailable,
    dispatchRuntimeRun: unavailable,
    recoverRuntimeRun: unavailable,
    cancelRuntimeRun: unavailable,
    syncRuntimeRun: unavailable,
    finalizeRuntimeRun: unavailable,
    runEvents: unavailable,
    getRunReview: unavailable,
    getRunInputRequest: unavailable,
    answerRunInput: unavailable,
    acceptArtifactReturn: unavailable,
    rejectArtifactReturn: unavailable,
    retryArtifactReturn: unavailable,
    refreshFileRecord: unavailable,
    adoptExternalChange: unavailable,
    createConversationImportSession: unavailable,
    uploadConversationChunk: unavailable,
    completeConversationImport: unavailable,
    importManualConversation: unavailable,
    conversations: unavailable,
    conversationProjection: unavailable,
    exportConversation: unavailable,
    conversationMessages: unavailable,
    searchConversations: unavailable,
    updateConversationSection: unavailable,
    refreshConversationSections: unavailable,
    annotateConversationSection: unavailable,
    pinConversationMessage: unavailable,
    conversationSemanticStatus: unavailable,
    buildConversationSemanticIndex: unavailable,
    applyMutations: unavailable,
    saveProjectGraph: unavailable,
    listContextSnapshots: unavailable,
    createContextSnapshot: unavailable,
    compareContextSnapshots: unavailable,
    branchContextSnapshot: unavailable,
    listHandoffs: unavailable,
    createHandoff: unavailable,
    deleteHandoff: unavailable,
    presentationList: unavailable,
    presentationGet: unavailable,
    presentationSave: unavailable,
    mutationReceipt: unavailable,
    presentationDelete: unavailable,
    streamPresentation: unavailable,
    streamProjectPresentations: unavailable,
    streamProjectEvents: unavailable,
    createReorganizeProposal: unavailable,
    previewReorganize: unavailable,
    applyReorganize: unavailable,
    rollbackReorganize: unavailable,
    rejectReorganize: unavailable,
    ...overrides,
  } as LocalCoreClient
}

describe('RuntimeBridge mutation serialization', () => {
  it('projects Runtime ArtifactRevision and FileRecord identity onto Canvas nodes', () => {
    const graph = snapshot()
    const currentRevisionId = 'revision-brief-initial' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
    const fileRecordId = 'file-brief' as ProjectGraphSnapshot['fileRecords'][number]['id']
    const state = mapGraphToState({
      ...graph,
      artifacts: [{ ...graph.artifacts[0], currentRevisionId }],
      artifactViews: [{ ...graph.artifactViews[0], revisionId: currentRevisionId }],
      artifactRevisions: [{
        id: currentRevisionId,
        artifactId: graph.artifacts[0].id,
        fileRecordId,
        contentHash: 'abcdef1234567890' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
        source: 'import',
        status: 'current',
        createdAt: NOW,
      }],
      fileRecords: [{
        id: fileRecordId,
        projectId: graph.project.id,
        observedPath: 'E:/sample/brief.md',
        observedHash: 'abcdef1234567890' as ProjectGraphSnapshot['fileRecords'][number]['observedHash'],
        size: 123,
        modifiedAt: NOW,
        mimeType: 'text/markdown',
        availability: 'current',
        observedAt: NOW,
      }],
    }, 'disposable-portasplit')

    expect(state.nodes[0]).toMatchObject({
      id: 'brief',
      artifactId: 'brief',
      revisionId: currentRevisionId,
      fileRecordId,
      contentHash: 'abcdef1234567890',
      observedPath: 'E:/sample/brief.md',
      followsCurrentRevision: true,
      previewStatus: 'not-generated',
    })
  })

  it('projects legacy orphan scope IDs onto the canonical Runtime root', () => {
    const graph = snapshot()
    const rootId = 'scope-mvp-root' as ProjectGraphSnapshot['scopes'][number]['id']
    const state = mapGraphToState({
      ...graph,
      scopes: [{ ...graph.scopes[0]!, id: rootId }],
      artifactViews: [{ ...graph.artifactViews[0]!, scopeId: 'scope-root' as ProjectGraphSnapshot['artifactViews'][number]['scopeId'] }],
      workspaces: [{ ...graph.workspaces[0]!, scopeId: 'scope-root' as ProjectGraphSnapshot['workspaces'][number]['scopeId'] }],
    }, 'disposable-portasplit')

    expect(state.activeScopeId).toBe(rootId)
    expect(state.nodes[0]?.scopeId).toBe(rootId)
    expect(state.workspaces[0]?.scopeId).toBe(rootId)
  })

  it('makes primary Views follow Current while explicit additional Views stay pinned', () => {
    const graph = snapshot()
    const artifact = graph.artifacts[0]!
    const oldRevision = {
      id: 'revision-old' as ProjectGraphSnapshot['artifactRevisions'][number]['id'],
      artifactId: artifact.id,
      fileRecordId: 'file-old' as ProjectGraphSnapshot['fileRecords'][number]['id'],
      contentHash: 'oldhash' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      source: 'import' as const,
      status: 'superseded' as const,
      createdAt: NOW,
    }
    const currentRevision = {
      ...oldRevision,
      id: 'revision-current' as ProjectGraphSnapshot['artifactRevisions'][number]['id'],
      fileRecordId: 'file-current' as ProjectGraphSnapshot['fileRecords'][number]['id'],
      contentHash: 'currenthash' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      status: 'current' as const,
    }
    const primary = { ...graph.artifactViews[0]!, revisionId: oldRevision.id, referenceKind: 'primary' as const }
    const pinned = {
      ...primary,
      id: 'view-pinned' as ProjectGraphSnapshot['artifactViews'][number]['id'],
      referenceKind: 'explicit_additional' as const,
    }
    const state = mapGraphToState({
      ...graph,
      artifacts: [{ ...artifact, currentRevisionId: currentRevision.id }],
      artifactViews: [primary, pinned],
      artifactRevisions: [oldRevision, currentRevision],
    }, 'disposable-portasplit')

    expect(state.nodes.find((node) => node.id === String(primary.id))).toMatchObject({
      revisionId: currentRevision.id,
      followsCurrentRevision: true,
    })
    expect(state.nodes.find((node) => node.id === String(pinned.id))).toMatchObject({
      revisionId: oldRevision.id,
      followsCurrentRevision: false,
    })
  })

  it('projects Runtime PreviewRecord status onto Canvas nodes', () => {
    const graph = snapshot()
    const currentRevisionId = 'revision-brief-initial' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
    const fileRecordId = 'file-brief' as ProjectGraphSnapshot['fileRecords'][number]['id']
    const state = mapGraphToState({
      ...graph,
      artifacts: [{ ...graph.artifacts[0], currentRevisionId }],
      artifactViews: [{ ...graph.artifactViews[0], revisionId: currentRevisionId }],
      artifactRevisions: [{
        id: currentRevisionId,
        artifactId: graph.artifacts[0].id,
        fileRecordId,
        contentHash: 'abcdef1234567890' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
        source: 'import',
        status: 'current',
        createdAt: NOW,
      }],
    }, 'disposable-portasplit', [{
      id: 'preview-brief' as never,
      projectId: graph.project.id,
      revisionId: currentRevisionId,
      sourceContentHash: 'abcdef1234567890' as never,
      rendererId: 'markdown-preview',
      rendererVersion: '0.1.0',
      previewProfile: 'card',
      cacheKey: 'preview:key',
      cachePath: 'cache/preview.html',
      mimeType: 'text/html',
      size: 321,
      status: 'ready',
      createdAt: NOW,
      updatedAt: NOW,
    }])

    expect(state.nodes[0]).toMatchObject({
      previewStatus: 'ready',
      previewProfile: 'card',
      previewRenderer: 'markdown-preview@0.1.0',
    })
  })

  it('projects ready text PreviewRecord content onto Canvas nodes', () => {
    const graph = snapshot()
    const currentRevisionId = 'revision-brief-initial' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
    const fileRecordId = 'file-brief' as ProjectGraphSnapshot['fileRecords'][number]['id']
    const previewId = 'preview-brief' as never
    const state = mapGraphToState({
      ...graph,
      artifacts: [{ ...graph.artifacts[0], currentRevisionId }],
      artifactViews: [{ ...graph.artifactViews[0], revisionId: currentRevisionId }],
      artifactRevisions: [{
        id: currentRevisionId,
        artifactId: graph.artifacts[0].id,
        fileRecordId,
        contentHash: 'abcdef1234567890' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
        source: 'import',
        status: 'current',
        createdAt: NOW,
      }],
    }, 'disposable-portasplit', [{
      id: previewId,
      projectId: graph.project.id,
      revisionId: currentRevisionId,
      sourceContentHash: 'abcdef1234567890' as never,
      rendererId: 'markdown',
      rendererVersion: '0.1.0',
      previewProfile: 'thumbnail',
      cacheKey: 'preview:key',
      cachePath: 'cache/preview.md',
      mimeType: 'text/markdown',
      size: 21,
      status: 'ready',
      createdAt: NOW,
      updatedAt: NOW,
    }], new Map([[String(previewId), {
      previewRecordId: String(previewId),
      mimeType: 'text/markdown',
      size: 21,
      encoding: 'base64',
      data: Buffer.from('# Real markdown preview').toString('base64'),
    }]]))

    expect(state.nodes[0]).toMatchObject({
      previewStatus: 'ready',
      previewMimeType: 'text/markdown',
      previewText: '# Real markdown preview',
      previewDataUrl: expect.stringContaining('data:text/markdown;base64,'),
    })
  })

  it('prefers the ready PreviewRecord when a revision has stale unsupported records', () => {
    const graph = snapshot()
    const currentRevisionId = 'revision-brief-initial' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
    const fileRecordId = 'file-brief' as ProjectGraphSnapshot['fileRecords'][number]['id']
    const revision = {
      id: currentRevisionId,
      artifactId: graph.artifacts[0].id,
      fileRecordId,
      contentHash: 'abcdef1234567890' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      source: 'import' as const,
      status: 'current' as const,
      createdAt: NOW,
    }
    const readyId = 'preview-ready' as never
    // 先 unsupported（旧 profile 触发），后 ready（thumbnail）：后者必须胜出
    const state = mapGraphToState({
      ...graph,
      artifacts: [{ ...graph.artifacts[0], currentRevisionId }],
      artifactViews: [{ ...graph.artifactViews[0], revisionId: currentRevisionId }],
      artifactRevisions: [revision],
    }, 'disposable-portasplit', [
      {
        id: 'preview-stale' as never,
        projectId: graph.project.id,
        revisionId: currentRevisionId,
        sourceContentHash: 'abcdef1234567890' as never,
        rendererId: 'markdown',
        rendererVersion: '1',
        previewProfile: 'card',
        cacheKey: 'preview:stale',
        cachePath: 'cache/stale',
        mimeType: 'application/octet-stream',
        size: 0,
        status: 'unsupported',
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: readyId,
        projectId: graph.project.id,
        revisionId: currentRevisionId,
        sourceContentHash: 'abcdef1234567890' as never,
        rendererId: 'markdown',
        rendererVersion: '1',
        previewProfile: 'thumbnail',
        cacheKey: 'preview:ready',
        cachePath: 'cache/ready',
        mimeType: 'text/markdown',
        size: 21,
        status: 'ready',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ], new Map([[String(readyId), {
      previewRecordId: String(readyId),
      mimeType: 'text/markdown',
      size: 21,
      encoding: 'base64',
      data: Buffer.from('ready wins').toString('base64'),
    }]]))

    expect(state.nodes[0]).toMatchObject({
      previewStatus: 'ready',
      previewProfile: 'thumbnail',
      previewMimeType: 'text/markdown',
      previewText: 'ready wins',
    })
  })

  it('projects artifact_view-anchored Core notes as located note nodes', () => {
    const graph = snapshot()
    const noteId = 'note-anchored' as ProjectGraphSnapshot['notes'][number]['id']
    const state = mapGraphToState({
      ...graph,
      notes: [{
        id: noteId,
        projectId: graph.project.id,
        anchor: { type: 'artifact_view', viewId: graph.artifactViews[0].id },
        body: '定位说明\n这是备注正文',
        createdAt: NOW,
        updatedAt: NOW,
      }],
    }, 'disposable-portasplit')

    const note = state.nodes.find((node) => node.id === String(noteId))
    expect(note).toMatchObject({
      kind: 'note',
      title: '定位说明',
      noteBody: '定位说明\n这是备注正文',
      anchors: [{ type: 'artifact_view', viewId: String(graph.artifactViews[0].id) }],
      x: 10 + 24,
      y: 20 + 140 + 24,
      scopeId: 'scope-root',
    })
    expect(state.edges.find((edge) => edge.id === `note-edge-${String(noteId)}`)).toMatchObject({
      from: String(noteId),
      to: String(graph.artifactViews[0].id),
      kind: 'reference',
      scope: 'presentation',
      origin: 'system',
    })
  })

  it('projects project-anchored Core notes with a deterministic fallback position', () => {
    const graph = snapshot()
    const noteId = 'note-project' as ProjectGraphSnapshot['notes'][number]['id']
    const state = mapGraphToState({
      ...graph,
      notes: [{
        id: noteId,
        projectId: graph.project.id,
        anchor: { type: 'project' },
        body: '项目级备注',
        createdAt: NOW,
        updatedAt: NOW,
      }],
    }, 'disposable-portasplit')

    expect(state.nodes).toHaveLength(graph.artifactViews.length + 1)
    expect(state.nodes.at(-1)).toMatchObject({
      kind: 'note',
      anchors: [{ type: 'project' }],
      x: 10 + 200 + 28,
      y: 48,
      scopeId: 'scope-root',
    })
    expect(state.edges.some((edge) => edge.id === `note-edge-${String(noteId)}`)).toBe(false)
  })

  it('persists Scope container View identity instead of dropping the aggregate node link', () => {
    const current = state()
    current.nodes.push({
      id: 'context-container', kind: 'context', title: 'Context 1', subtitle: 'Context',
      x: 260, y: 40, width: 220, height: 130, scopeId: 'scope-root', opensScopeId: 'scope-context-1',
    })
    current.scopes.push({
      id: 'scope-context-1', label: 'Context 1', kind: 'context', parentScopeId: 'scope-root',
      containerNodeId: 'context-container', camera: { x: 0, y: 0, zoom: 1 },
    })

    const graph = mapStateToGraph(current, 'disposable-portasplit')
    expect(graph.scopes.find((scope) => String(scope.id) === 'scope-context-1')?.containerViewId).toBe('context-container')

    const before = state()
    const ops = diffStateToOps(before, current, 'disposable-portasplit')
    const childScope = ops.find((op) => op.type === 'upsert_scope' && String(op.scope.id) === 'scope-context-1')
    expect(childScope).toBeDefined()
    if (childScope?.type === 'upsert_scope') expect(childScope.scope.containerViewId).toBe('context-container')
  })

  it('never serializes projected note nodes as artifacts or view deletions', () => {
    const graph = snapshot()
    const previous = mapGraphToState(graph, 'disposable-portasplit')
    const noteId = 'note-anchored' as ProjectGraphSnapshot['notes'][number]['id']
    const state = mapGraphToState({
      ...graph,
      notes: [{
        id: noteId,
        projectId: graph.project.id,
        anchor: { type: 'artifact_view', viewId: graph.artifactViews[0].id },
        body: '只读投影',
        createdAt: NOW,
        updatedAt: NOW,
      }],
    }, 'disposable-portasplit')

    const ops = diffStateToOps(previous, state, 'disposable-portasplit')
    const artifactOps = ops.filter((op) => op.type === 'upsert_artifact' || op.type === 'upsert_artifact_view' || op.type === 'delete_artifact_view')
    expect(artifactOps.some((op) => {
      const payload = op as { artifact?: { id?: string }; view?: { id?: string }; viewId?: string }
      return payload.artifact?.id === String(noteId) || payload.view?.id === String(noteId) || payload.viewId === String(noteId)
    })).toBe(false)
  })

  it('executes slow A before B and acknowledges B as the final state/version', async () => {
    let releaseA!: () => void
    const aGate = new Promise<void>((resolve) => { releaseA = resolve })
    const batches: MutationBatch[] = []
    const applyMutations = vi.fn(async (batch: MutationBatch) => {
      batches.push(batch)
      if (batches.length === 1) await aGate
      const value: MutationResult = {
        graphVersion: (batches.length + 1) as GraphVersion,
        appliedOps: batch.ops.length,
      }
      return call(value)
    })
    const bridge = new RuntimeBridge('disposable-portasplit', mockClient({ applyMutations }))
    await bridge.loadProject()

    const saveA = bridge.saveMutations(state('Title A'))
    await vi.waitFor(() => expect(applyMutations).toHaveBeenCalledTimes(1))
    const saveB = bridge.saveMutations(state('Title B'))
    await Promise.resolve()
    expect(applyMutations).toHaveBeenCalledTimes(1)

    releaseA()
    await expect(saveA).resolves.toEqual({ status: 'saved' })
    await expect(saveB).resolves.toEqual({ status: 'saved' })
    expect(applyMutations).toHaveBeenCalledTimes(2)
    expect(batches[0].baseVersion).toBe(1)
    expect(batches[1].baseVersion).toBe(2)
    expect(batches[1].ops).toEqual([
      expect.objectContaining({
        type: 'upsert_artifact',
        artifact: expect.objectContaining({ title: 'Title B' }),
      }),
    ])

    await expect(bridge.saveMutations(state('Title B'))).resolves.toEqual({ status: 'saved' })
    expect(applyMutations).toHaveBeenCalledTimes(2)
    expect(bridge.pendingMutationCount).toBe(0)
  })

  it('bootstraps the project snapshot before the first runtime mutation save', async () => {
    const applyMutations = vi.fn(async (batch: MutationBatch) => call({ graphVersion: 2 as GraphVersion, appliedOps: batch.ops.length }))
    const saveProjectGraph = vi.fn(async (value: ProjectGraphSnapshot) => call({ ...value, graphVersion: 1 as GraphVersion }))
    const bridge = new RuntimeBridge('disposable-portasplit', mockClient({ applyMutations, saveProjectGraph }))

    await expect(bridge.saveMutations(state('First runtime save'))).resolves.toEqual({ status: 'saved' })

    expect(saveProjectGraph).toHaveBeenCalledTimes(1)
    expect(saveProjectGraph.mock.calls[0][0]).toMatchObject({
      project: { id: 'disposable-portasplit' },
      artifacts: [expect.objectContaining({ id: 'brief', title: 'First runtime save' })],
      artifactViews: [expect.objectContaining({ id: 'brief', artifactId: 'brief' })],
    })
    expect(applyMutations).not.toHaveBeenCalled()

    await expect(bridge.saveMutations(state('Second runtime save'))).resolves.toEqual({ status: 'saved' })
    expect(applyMutations).toHaveBeenCalledTimes(1)
  })

  it('maps move and focus changes to presentation operations but ignores camera navigation', () => {
    const before = state()
    const after = structuredClone(before)
    after.nodes[0].x = 88
    after.nodes[0].y = 99
    after.workspaces[0].camera = { x: 4, y: 5, zoom: 1.2 }
    after.workspaces[0].focusedViewIds = []

    const ops = diffStateToOps(before, after, 'disposable-portasplit')
    expect(ops.map((op) => op.type)).toEqual([
      'update_workspace_presentation',
      'move_artifact_view',
    ])
    expect(ops.some((op) => op.type === 'update_workspace_viewport')).toBe(false)
    expect(ops.some((op) => op.type.startsWith('upsert_'))).toBe(false)
  })

  it('emits reorder_workspaces when only the workspace order changes (Phase 1 rail order)', () => {
    const before = state()
    const second = structuredClone(before.workspaces[0])
    second.id = 'workspace-second'
    before.workspaces = [before.workspaces[0], second]
    const after = structuredClone(before)
    after.workspaces = [after.workspaces[1], after.workspaces[0]]

    const ops = diffStateToOps(before, after, 'disposable-portasplit')
    const reorder = ops.find((op) => op.type === 'reorder_workspaces')
    expect(reorder).toBeDefined()
    if (reorder?.type === 'reorder_workspaces') {
      expect(reorder.workspaceIds).toEqual(['workspace-second', before.workspaces[0].id])
    }
    expect(ops.filter((op) => op.type === 'upsert_workspace' || op.type === 'delete_workspace')).toHaveLength(0)
  })

  it('emits delete_workspace when a workspace is removed from state (Phase 1 rail cleanup)', () => {
    const before = state()
    const second = structuredClone(before.workspaces[0])
    second.id = 'workspace-second'
    before.workspaces = [before.workspaces[0], second]
    const after = structuredClone(before)
    after.workspaces = [after.workspaces[0]]

    const ops = diffStateToOps(before, after, 'disposable-portasplit')
    const del = ops.find((op) => op.type === 'delete_workspace')
    expect(del).toBeDefined()
    if (del?.type === 'delete_workspace') expect(del.workspaceId).toBe('workspace-second')
    expect(ops.some((op) => op.type === 'reorder_workspaces')).toBe(false)
  })

  it('persists and projects workspace aggregate relation endpoints (Phase4 boundary #1)', () => {
    const workspaceId = 'workspace-main'

    // graph -> state: workspace endpoint becomes a workspace:<id> canvas edge
    const base = snapshot()
    const graph = {
      ...base,
      relations: [{
      id: 'rel-ws-1',
      projectId: base.project.id,
      sourceEntityType: 'workspace',
      sourceEntityId: workspaceId,
      targetEntityType: 'artifact',
      targetEntityId: 'brief',
      kind: 'reference',
      createdAt: NOW,
      updatedAt: NOW,
      } as ProjectGraphSnapshot['relations'][number]],
    }
    const stateFromGraph = mapGraphToState(graph, 'disposable-portasplit')
    const wsEdge = stateFromGraph.edges.find((edge) => edge.from === `workspace:${workspaceId}` || edge.to === `workspace:${workspaceId}`)
    expect(wsEdge).toBeDefined()
    expect(wsEdge?.from).toBe(`workspace:${workspaceId}`)

    // state -> ops: workspace endpoint edge persists as a workspace-typed relation
    const before = state()
    const after = structuredClone(before)
    after.edges = [...after.edges, { id: 'edge-ws-1', from: `workspace:${workspaceId}`, to: 'brief', kind: 'reference', active: false }]
    const ops = diffStateToOps(before, after, 'disposable-portasplit')
    const rel = ops.find((op) => op.type === 'upsert_relation')
    expect(rel).toBeDefined()
    if (rel?.type === 'upsert_relation') {
      expect(rel.relation.sourceEntityType).toBe('workspace')
      expect(rel.relation.sourceEntityId).toBe(workspaceId)
      expect(rel.relation.targetEntityType).toBe('artifact')
    }
  })

  it('returns unsaved on stale 409, reloads once, and never replays the old operation', async () => {
    const projectGraph = vi.fn()
      .mockResolvedValueOnce(call(snapshot('Brief', 4)))
      .mockResolvedValueOnce(call(snapshot('Remote title', 5)))
    const applyMutations = vi.fn(async () => ({
      result: {
        ok: false as const,
        error: {
          code: 'STALE_GRAPH_VERSION' as const,
          message: 'Graph version is stale.',
          retryable: true,
          origin: 'runtime' as const,
        },
      },
      origin: 'runtime' as const,
      latencyMs: 0,
      requestedAt: NOW,
    }))
    const bridge = new RuntimeBridge(
      'disposable-portasplit',
      mockClient({ projectGraph, applyMutations }),
    )
    await bridge.loadProject()

    const result = await bridge.saveMutations(state('Local stale edit'))

    expect(result).toMatchObject({ status: 'unsaved', error: expect.stringContaining('reloaded') })
    expect(applyMutations).toHaveBeenCalledTimes(1)
    expect(projectGraph).toHaveBeenCalledTimes(2)
    expect(bridge.pendingMutationCount).toBe(0)
  })
})
