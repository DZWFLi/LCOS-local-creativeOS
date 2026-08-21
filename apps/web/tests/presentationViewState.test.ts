import { describe, expect, it } from 'vitest'

import type { PresentationViewV0 } from '@local-creative-os/contracts'

import { emptyPresentationState, presentationBridgeKey, PresentationViewSessionCore, reconcilePresentationStateMembers, registerPresentationBridge, subscribePresentationBridge } from '../src/state/presentationViewState'

class FakeClient {
  views = new Map<string, PresentationViewV0>()
  saveCalls: Array<{ presentationId: string; expectedVersion: number }> = []

  async presentationGet(projectId: string, presentationId: string) {
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

  async presentationSave(projectId: string, presentationId: string, contract: PresentationViewV0, expectedVersion: number) {
    this.saveCalls.push({ presentationId, expectedVersion })
    const existing = this.views.get(presentationId)
    if (existing !== undefined && existing.version !== expectedVersion) {
      return {
        result: { ok: false as const, error: { code: 'STALE_PRESENTATION_VERSION' as const, message: 'stale', retryable: false } },
        origin: 'runtime' as const,
        latencyMs: 0,
        requestedAt: '',
      }
    }
    const next: PresentationViewV0 = { ...contract, version: existing === undefined ? contract.version : existing.version + 1 }
    this.views.set(presentationId, next)
    return { result: { ok: true as const, value: next }, origin: 'runtime' as const, latencyMs: 0, requestedAt: '' }
  }

  async mutationReceipt() {
    return {
      result: { ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'missing', retryable: false } },
      origin: 'runtime' as const,
      latencyMs: 0,
      requestedAt: '',
    }
  }
}

const deps = (client: FakeClient, seedMembers: string[] = []) => ({
  client: client as never,
  projectId: 'project-a',
  scopeId: 'scope-root',
  capability: 'context' as const,
  renderer: 'context',
  seedState: () => emptyPresentationState(seedMembers),
  now: () => '2026-08-10T00:00:00.000Z',
})

describe('PresentationViewSessionCore (Phase B)', () => {
  it('loads an existing view and restores its state', async () => {
    const client = new FakeClient()
    const persisted = {
      schemaVersion: 0 as const,
      id: 'presentation:context:scope-root',
      projectId: 'project-a',
      scopeId: 'scope-root',
      capability: 'context' as const,
      renderer: 'context',
      state: emptyPresentationState(['view-a', 'view-b']),
      version: 4,
      updatedBy: 'web' as const,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    }
    client.views.set(persisted.id, persisted)
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    expect(session.ready).toBe(true)
    expect(session.view?.version).toBe(4)
    expect(session.view?.state.memberViewIds).toEqual(['view-a', 'view-b'])
  })

  it('seeds a missing view once and becomes ready', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client, ['view-a']))
    await session.load()
    expect(session.ready).toBe(true)
    expect(session.view?.state.memberViewIds).toEqual(['view-a'])
    expect(client.views.has('presentation:context:scope-root')).toBe(true)
  })

  it('patches optimistically and flushes with CAS version', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    session.patch((state) => ({ ...state, memberViewIds: ['view-a'] }))
    expect(session.view?.state.memberViewIds).toEqual(['view-a'])
    await session.flush()
    expect(client.saveCalls[0]!.expectedVersion).toBe(0)
    expect(session.view?.version).toBe(1)
    expect(client.views.get('presentation:context:scope-root')?.state.memberViewIds).toEqual(['view-a'])
  })

  it('does not replay a non-idempotent patch onto an already optimistic state', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    session.patch((state) => ({ ...state, memberViewIds: [...state.memberViewIds, 'view-a'] }))
    expect(session.view?.state.memberViewIds).toEqual(['view-a'])
    await session.flush()
    expect(client.views.get('presentation:context:scope-root')?.state.memberViewIds).toEqual(['view-a'])
  })

  it('composes multiple patches in one flush instead of dropping the earlier intent (HU-3 §8)', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    // 位置 + pin 同帧两次 patch：flush 后两者都必须落库，后一个不能覆盖前一个。
    session.patch((state) => ({ ...state, positions: { 'view-a': { x: 10, y: 20 } } }))
    session.patch((state) => ({ ...state, pinnedViewIds: ['view-a'] }))
    await session.flush()
    const saved = client.views.get('presentation:context:scope-root')?.state
    expect(saved?.positions).toEqual({ 'view-a': { x: 10, y: 20 } })
    expect(saved?.pinnedViewIds).toEqual(['view-a'])
  })

  it('retries once on CAS conflict after reloading latest', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    // Another writer bumps the version behind our back.
    client.views.set('presentation:context:scope-root', {
      ...client.views.get('presentation:context:scope-root')!,
      version: 3,
      state: emptyPresentationState(['remote-view']),
    })
    session.patch((state) => ({ ...state, memberViewIds: ['view-a'] }))
    await session.flush()
    expect(session.view?.version).toBe(4)
    expect(session.view?.state.memberViewIds).toEqual(['view-a'])
  })

  it('retains optimistic intent when a durable save outcome is unknown', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    client.presentationSave = (async () => ({
      result: { ok: false as const, error: { code: 'CORE_UNAVAILABLE' as never, message: 'offline', retryable: true } },
      origin: 'runtime' as const,
      latencyMs: 0,
      requestedAt: '',
    })) as never
    session.patch((state) => ({ ...state, memberViewIds: ['unsaved-view'] }))
    expect(session.view?.state.memberViewIds).toEqual(['unsaved-view'])
    await session.flush()
    expect(session.ready).toBe(true)
    expect(session.view?.state.memberViewIds).toEqual(['unsaved-view'])
  })

  it('applies remote changes with higher versions', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    session.applyRemote({
      ...session.view!,
      version: 9,
      state: emptyPresentationState(['remote-view']),
    })
    expect(session.view?.version).toBe(9)
    expect(session.view?.state.memberViewIds).toEqual(['remote-view'])
  })

  it('ignores late remote snapshots that would move committed state backwards', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore(deps(client))
    await session.load()
    session.applyRemote({ ...session.view!, version: 5, state: emptyPresentationState(['newer']) })
    session.applyRemote({ ...session.view!, version: 3, state: emptyPresentationState(['stale']) })
    expect(session.view?.version).toBe(5)
    expect(session.view?.state.memberViewIds).toEqual(['newer'])
  })

  it('notifies bridge-registry subscribers when a bridge registers (restore ordering fix)', () => {
    const key = presentationBridgeKey('project-a', 'scope-root', 'context')
    let notified = 0
    const unsubscribe = subscribePresentationBridge(key, () => { notified += 1 })
    registerPresentationBridge('project-a', 'scope-root', 'context', {
      ready: true,
      state: emptyPresentationState(['view-a']),
      patch: () => undefined,
      flushSoon: () => undefined,
      subscribe: () => () => undefined,
    })
    expect(notified).toBe(1)
    unsubscribe()
    registerPresentationBridge('project-a', 'scope-root', 'context', {
      ready: true,
      state: emptyPresentationState([]),
      patch: () => undefined,
      flushSoon: () => undefined,
      subscribe: () => () => undefined,
    })
    expect(notified).toBe(1)
  })
  it('reconciles every Presentation-local structure when exact membership changes', () => {
    const state = {
      ...emptyPresentationState(['view-a', 'view-b']),
      hiddenViewIds: ['view-a'],
      positions: { 'view-a': { x: 1, y: 2 }, 'view-b': { x: 3, y: 4 } },
      hierarchy: { parentByViewId: { 'view-a': null, 'view-b': 'view-a' }, orderByParent: { '': ['view-a'], 'view-a': ['view-b'] } },
      presentationEdges: [{ id: 'a-b', fromViewId: 'view-a', toViewId: 'view-b' }],
      pinnedViewIds: ['view-a'],
      emphasisByViewId: { 'view-a': 'primary' as const, 'view-b': 'normal' as const },
      trackSegments: [{ id: 's', memberViewIds: ['view-a', 'view-b'], order: 0, collapsed: false }],
    }
    const next = reconcilePresentationStateMembers(state, ['view-b'])
    expect(next.memberViewIds).toEqual(['view-b'])
    expect(next.hiddenViewIds).toEqual([])
    expect(next.positions).toEqual({ 'view-b': { x: 3, y: 4 } })
    expect(next.hierarchy.parentByViewId).toEqual({ 'view-b': null })
    expect(next.presentationEdges).toEqual([])
    expect(next.pinnedViewIds).toEqual([])
    expect(next.trackSegments?.[0]?.memberViewIds).toEqual(['view-b'])
  })

})
