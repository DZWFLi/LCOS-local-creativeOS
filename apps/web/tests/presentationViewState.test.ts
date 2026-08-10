import { describe, expect, it } from 'vitest'

import type { PresentationViewV0 } from '@local-creative-os/contracts'

import { emptyPresentationState, PresentationViewSessionCore } from '../src/state/presentationViewState'

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
})
