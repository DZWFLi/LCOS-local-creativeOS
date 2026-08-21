import { describe, expect, it } from 'vitest'

import type { PresentationViewV0 } from '@local-creative-os/contracts'

import { appendProjectPresentationEntityRefs, appendProjectPresentationMembers, loadProjectPresentationMembers, removeProjectPresentationEntityRefs, removeProjectPresentationMembers } from '../src/state/projectPresentationMembership'
import { emptyPresentationState } from '../src/state/presentationViewState'

class FakeClient {
  views = new Map<string, PresentationViewV0>()
  staleOnce = false

  async presentationGet(_projectId: string, presentationId: string) {
    const value = this.views.get(presentationId)
    return {
      result: value === undefined
        ? { ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'missing', retryable: false } }
        : { ok: true as const, value },
      origin: 'runtime' as const,
      latencyMs: 0,
      requestedAt: '',
    }
  }

  async presentationSave(_projectId: string, presentationId: string, contract: PresentationViewV0, expectedVersion: number) {
    const existing = this.views.get(presentationId)
    if (this.staleOnce) {
      this.staleOnce = false
      if (existing) this.views.set(presentationId, { ...existing, version: existing.version + 1, state: { ...existing.state, memberViewIds: [...existing.state.memberViewIds, 'remote'] } })
      return {
        result: { ok: false as const, error: { code: 'STALE_PRESENTATION_VERSION' as const, message: 'stale', retryable: false } },
        origin: 'runtime' as const,
        latencyMs: 0,
        requestedAt: '',
      }
    }
    if (existing !== undefined && existing.version !== expectedVersion) {
      return {
        result: { ok: false as const, error: { code: 'STALE_PRESENTATION_VERSION' as const, message: 'stale', retryable: false } },
        origin: 'runtime' as const,
        latencyMs: 0,
        requestedAt: '',
      }
    }
    const next: PresentationViewV0 = { ...contract, version: existing === undefined ? 0 : existing.version + 1 }
    this.views.set(presentationId, next)
    return { result: { ok: true as const, value: next }, origin: 'runtime' as const, latencyMs: 0, requestedAt: '' }
  }
}

const target = (client: FakeClient, capability: 'context' | 'workflow' = 'context') => ({
  client: client as never,
  projectId: 'project-a',
  ownerId: capability === 'context' ? 'context-a' : 'scope-root',
  capability,
  renderer: capability,
})

function persisted(memberViewIds: string[]): PresentationViewV0 {
  return {
    schemaVersion: 0,
    id: 'presentation:context:context-a',
    projectId: 'project-a',
    scopeId: 'context-a',
    capability: 'context',
    renderer: 'context',
    state: emptyPresentationState(memberViewIds),
    version: 2,
    updatedBy: 'web',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  }
}

describe('Project Presentation membership (R3.1-A)', () => {
  it('creates exact membership from existing Project View ids without cloning or scope assumptions', async () => {
    const client = new FakeClient()
    const result = await appendProjectPresentationMembers(target(client), ['view-root', 'view-collection', 'view-other-scope'])
    expect(result.ok).toBe(true)
    expect(result.memberViewIds).toEqual(['view-root', 'view-collection', 'view-other-scope'])
    expect(client.views.get('presentation:context:context-a')?.state.memberViewIds).toEqual(result.memberViewIds)
  })

  it('normalizes legacy Context clone identities to canonical Project View identities', async () => {
    const client = new FakeClient()
    client.views.set('presentation:context:context-a', persisted(['legacy-clone', 'view-b']))
    const normalizeMembers = (ids: readonly string[]) => ids.map((id) => id === 'legacy-clone' ? 'view-a' : id)
    const loaded = await loadProjectPresentationMembers({ ...target(client), normalizeMembers })
    expect(loaded.memberViewIds).toEqual(['view-a', 'view-b'])
    const appended = await appendProjectPresentationMembers({ ...target(client), normalizeMembers }, ['view-c'])
    expect(appended.memberViewIds).toEqual(['view-a', 'view-b', 'view-c'])
  })

  it('rebases an append once on CAS conflict without dropping the concurrent member', async () => {
    const client = new FakeClient()
    client.views.set('presentation:context:context-a', persisted(['view-a']))
    client.staleOnce = true
    const result = await appendProjectPresentationMembers(target(client), ['view-b'])
    expect(result.ok).toBe(true)
    expect(result.memberViewIds).toEqual(['view-a', 'remote', 'view-b'])
  })

  it('removes membership only from the Presentation and cleans member-local Presentation metadata', async () => {
    const client = new FakeClient()
    const base = persisted(['view-a', 'view-b'])
    client.views.set(base.id, {
      ...base,
      state: {
        ...base.state,
        positions: { 'view-a': { x: 1, y: 2 }, 'view-b': { x: 3, y: 4 } },
        hierarchy: { parentByViewId: { 'view-a': null, 'view-b': 'view-a' }, orderByParent: { '': ['view-a'], 'view-a': ['view-b'] } },
        presentationEdges: [{ id: 'edge-a-b', fromViewId: 'view-a', toViewId: 'view-b' }],
        pinnedViewIds: ['view-a'],
        emphasisByViewId: { 'view-a': 'primary', 'view-b': 'normal' },
        trackSegments: [{ id: 'segment-1', memberViewIds: ['view-a', 'view-b'], order: 0, collapsed: false }],
      },
    })
    const result = await removeProjectPresentationMembers(target(client), ['view-a'])
    expect(result.ok).toBe(true)
    expect(result.memberViewIds).toEqual(['view-b'])
    const state = client.views.get(base.id)!.state
    expect(state.positions['view-a']).toBeUndefined()
    expect(state.hierarchy.parentByViewId['view-b']).toBeNull()
    expect(state.presentationEdges).toEqual([])
    expect(state.pinnedViewIds).toEqual([])
    expect(state.trackSegments?.[0]?.memberViewIds).toEqual(['view-b'])
  })

  it('stores first-class aggregate entity refs without fake ArtifactViews', async () => {
    const client = new FakeClient()
    const aggregateTarget = { ...target(client), capability: 'custom' as const, ownerId: 'collection-a', renderer: 'collection' }
    const result = await appendProjectPresentationEntityRefs(aggregateTarget, [
      { type: 'workspace', id: 'workspace-1' },
      { type: 'scope', id: 'context-1' },
      { type: 'scope', id: 'context-1' },
    ])
    expect(result.ok).toBe(true)
    expect(result.memberViewIds).toEqual([])
    expect(result.memberEntityRefs).toEqual([
      { type: 'workspace', id: 'workspace-1' },
      { type: 'scope', id: 'context-1' },
    ])
    expect(client.views.get('presentation:custom:collection-a')?.state.memberEntityRefs).toEqual(result.memberEntityRefs)
  })

  it('separates stable Presentation identity from the real navigation Scope used for persistence', async () => {
    const client = new FakeClient()
    const workspaceTarget = {
      client: client as never,
      projectId: 'project-a',
      ownerId: 'workspace:ws-1',
      persistenceScopeId: 'scope-root',
      capability: 'custom' as const,
      renderer: 'workspace-scene',
    }
    const result = await appendProjectPresentationEntityRefs(workspaceTarget, [{ type: 'scope', id: 'context-a' }])
    expect(result.ok).toBe(true)
    const stored = client.views.get('presentation:custom:workspace:ws-1')
    expect(stored?.scopeId).toBe('scope-root')
    expect(stored?.state.memberEntityRefs).toEqual([{ type: 'scope', id: 'context-a' }])
  })

  it('removes aggregate entity refs without deleting ordinary Presentation members', async () => {
    const client = new FakeClient()
    const aggregateTarget = { ...target(client), capability: 'custom' as const, ownerId: 'collection-a', renderer: 'collection' }
    await appendProjectPresentationMembers(aggregateTarget, ['view-a'])
    await appendProjectPresentationEntityRefs(aggregateTarget, [{ type: 'scope', id: 'context-a' }, { type: 'workspace', id: 'ws-a' }])
    const result = await removeProjectPresentationEntityRefs(aggregateTarget, [{ type: 'scope', id: 'context-a' }])
    expect(result.ok).toBe(true)
    expect(result.memberViewIds).toEqual(['view-a'])
    expect(result.memberEntityRefs).toEqual([{ type: 'workspace', id: 'ws-a' }])
  })

  it('makes a re-dropped existing member visible again instead of silently keeping it hidden', async () => {
    const client = new FakeClient()
    const base = persisted(['view-a'])
    client.views.set(base.id, { ...base, state: { ...base.state, hiddenViewIds: ['view-a'] } })
    const result = await appendProjectPresentationMembers(target(client), ['view-a'])
    expect(result.ok).toBe(true)
    expect(client.views.get(base.id)?.state.hiddenViewIds).toEqual([])
  })

})
