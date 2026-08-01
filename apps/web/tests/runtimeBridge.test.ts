import type {
  GraphVersion,
  MutationBatch,
  MutationResult,
  ProjectGraphSnapshot,
} from '@local-creative-os/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { PersistedPrototypeState } from '../src/model'
import type { LocalCoreClient, RuntimeCall } from '../src/runtime/localCoreClient'
import { diffStateToOps, mapGraphToState, RuntimeBridge } from '../src/runtime/runtimeBridge'

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
    validateProjectRoot: unavailable,
    createProject: unavailable,
    importResourceUrl: unavailable,
    resourceList: unavailable,
    resourceDescriptor: unavailable,
    resourceReanalyze: unavailable,
    resourceRead: unavailable,
    importResourceDirectory: unavailable,
    importResourceArchive: unavailable,
    metadataStatus: unavailable,
    projectGraph: vi.fn(async () => call(snapshot())),
    updateActiveContext: unavailable,
    previewRecords: vi.fn(async () => call([])),
    previewContent: unavailable,
    generatePreview: unavailable,
    importCopy: unavailable,
    buildContextManifest: unavailable,
    createRuntimeRun: unavailable,
    projectRunReviews: unavailable,
    dispatchRuntimeRun: unavailable,
    recoverRuntimeRun: unavailable,
    syncRuntimeRun: unavailable,
    finalizeRuntimeRun: unavailable,
    getRunReview: unavailable,
    acceptArtifactReturn: unavailable,
    rejectArtifactReturn: unavailable,
    retryArtifactReturn: unavailable,
    refreshFileRecord: unavailable,
    adoptExternalChange: unavailable,
    applyMutations: unavailable,
    saveProjectGraph: unavailable,
    ...overrides,
  }
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
