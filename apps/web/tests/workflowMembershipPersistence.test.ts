import { describe, expect, it } from 'vitest'

import type { PresentationViewV0 } from '@local-creative-os/contracts'

import { emptyPresentationState, PresentationViewSessionCore } from '../src/state/presentationViewState'

class FakeClient {
  views = new Map<string, PresentationViewV0>()
  async presentationGet(projectId: string, presentationId: string) {
    const value = this.views.get(presentationId)
    return { result: value === undefined
      ? { ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'missing', retryable: false } }
      : { ok: true as const, value }, origin: 'runtime' as const, latencyMs: 0, requestedAt: '' }
  }
  async presentationSave(projectId: string, presentationId: string, contract: PresentationViewV0, expectedVersion: number) {
    const existing = this.views.get(presentationId)
    if (existing !== undefined && existing.version !== expectedVersion) {
      return { result: { ok: false as const, error: { code: 'STALE_PRESENTATION_VERSION' as const, message: 'stale', retryable: false } }, origin: 'runtime' as const, latencyMs: 0, requestedAt: '' }
    }
    const next = { ...contract, version: existing === undefined ? contract.version : existing.version + 1 }
    this.views.set(presentationId, next)
    return { result: { ok: true as const, value: next }, origin: 'runtime' as const, latencyMs: 0, requestedAt: '' }
  }
}

describe('Workflow membership persistence (Phase B B9)', () => {
  it('creates workflow presentation with stable id and persists members', async () => {
    const client = new FakeClient()
    const session = new PresentationViewSessionCore({
      client: client as never,
      projectId: 'project-a',
      scopeId: 'scope-root',
      capability: 'workflow',
      renderer: 'workflow',
      seedState: () => emptyPresentationState(['view-x']),
      now: () => '2026-08-10T00:00:00.000Z',
    })
    await session.load()
    expect(session.view?.id).toBe('presentation:workflow:scope-root')
    session.patch((state) => ({ ...state, memberViewIds: ['view-x', 'view-y'] }))
    await session.flush()
    expect(client.views.get('presentation:workflow:scope-root')?.state.memberViewIds).toEqual(['view-x', 'view-y'])
  })
})
