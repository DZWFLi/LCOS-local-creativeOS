import type {
  GraphVersion,
  MutationBatch,
  MutationResult,
  ProjectGraphSnapshot,
} from '@local-creative-os/contracts'
import { describe, expect, it, vi } from 'vitest'

import type { PersistedPrototypeState } from '../src/model'
import type { LocalCoreClient, RuntimeCall } from '../src/runtime/localCoreClient'
import { diffStateToOps, RuntimeBridge } from '../src/runtime/runtimeBridge'

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
      localPath: 'disposable://brief',
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
    metadataStatus: unavailable,
    projectGraph: vi.fn(async () => call(snapshot())),
    applyMutations: unavailable,
    saveProjectGraph: unavailable,
    ...overrides,
  }
}

describe('RuntimeBridge mutation serialization', () => {
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

  it('maps move, viewport, and focus changes only to presentation operations', () => {
    const before = state()
    const after = structuredClone(before)
    after.nodes[0].x = 88
    after.nodes[0].y = 99
    after.workspaces[0].camera = { x: 4, y: 5, zoom: 1.2 }
    after.workspaces[0].focusedViewIds = []

    const ops = diffStateToOps(before, after, 'disposable-portasplit')
    expect(ops.map((op) => op.type)).toEqual([
      'update_workspace_viewport',
      'update_workspace_presentation',
      'move_artifact_view',
    ])
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
