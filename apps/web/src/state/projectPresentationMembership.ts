import type { PresentationCapabilityV0, PresentationEntityRefV0, PresentationViewV0 } from '@local-creative-os/contracts'

import type { LocalCoreClient } from '../runtime/localCoreClient'
import { emptyPresentationState, presentationIdFor, reconcilePresentationStateMembers } from './presentationViewState'

export interface PresentationMembersResult {
  readonly ok: boolean
  readonly memberViewIds: string[]
  readonly memberEntityRefs: PresentationEntityRefV0[]
  readonly found?: boolean
  readonly message?: string
}

interface PresentationTarget {
  readonly client: LocalCoreClient
  readonly projectId: string
  readonly ownerId: string
  readonly capability: Extract<PresentationCapabilityV0, 'context' | 'workflow' | 'custom'>
  readonly renderer: string
  /** Stable Presentation identity may be an Entity id (for example workspace:<id>)
   * while Core still persists the row under a real navigation Scope. */
  readonly persistenceScopeId?: string
  readonly normalizeMembers?: (ids: readonly string[]) => string[]
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

export function uniquePresentationEntityRefs(refs: readonly PresentationEntityRefV0[]): PresentationEntityRefV0[] {
  const seen = new Set<string>()
  const result: PresentationEntityRefV0[] = []
  refs.forEach((ref) => {
    const key = `${ref.type}:${ref.id}`
    if (!ref.id || seen.has(key)) return
    seen.add(key)
    result.push({ type: ref.type, id: ref.id })
  })
  return result
}

function normalized(target: PresentationTarget, ids: readonly string[]): string[] {
  return unique(target.normalizeMembers?.(ids) ?? ids)
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function reconcileForAppend(state: PresentationViewV0['state'], members: readonly string[], revealIds: readonly string[]) {
  const next = reconcilePresentationStateMembers(state, members)
  if (!revealIds.length) return next
  const reveal = new Set(revealIds)
  return { ...next, hiddenViewIds: next.hiddenViewIds.filter((id) => !reveal.has(id)) }
}

function contractFor(target: PresentationTarget, memberViewIds: readonly string[], now: string): PresentationViewV0 {
  return {
    schemaVersion: 0,
    id: presentationIdFor(target.capability, target.ownerId),
    projectId: target.projectId,
    scopeId: target.persistenceScopeId ?? target.ownerId,
    capability: target.capability,
    renderer: target.renderer,
    state: emptyPresentationState(memberViewIds),
    version: 0,
    updatedBy: 'web',
    createdAt: now,
    updatedAt: now,
  }
}

/** Project-wide Presentation membership. ownerId identifies the Presentation only. */
export async function loadProjectPresentationMembers(target: PresentationTarget): Promise<PresentationMembersResult> {
  const call = await target.client.presentationGet(target.projectId, presentationIdFor(target.capability, target.ownerId))
  if (call.result.ok) return {
    ok: true,
    found: true,
    memberViewIds: normalized(target, call.result.value.state.memberViewIds),
    memberEntityRefs: uniquePresentationEntityRefs(call.result.value.state.memberEntityRefs ?? []),
  }
  if (call.result.error.code === 'NOT_FOUND') return { ok: true, found: false, memberViewIds: [], memberEntityRefs: [] }
  return { ok: false, memberViewIds: [], memberEntityRefs: [], message: call.result.error.message }
}

/** Append existing Project View identities without cloning or moving them. */
export async function appendProjectPresentationMembers(
  target: PresentationTarget,
  viewIds: readonly string[],
  seedViewIds: readonly string[] = [],
): Promise<PresentationMembersResult> {
  const additions = unique(viewIds)
  if (!additions.length) return loadProjectPresentationMembers(target)

  const presentationId = presentationIdFor(target.capability, target.ownerId)
  const current = await target.client.presentationGet(target.projectId, presentationId)
  const now = new Date().toISOString()

  if (!current.result.ok) {
    if (current.result.error.code !== 'NOT_FOUND') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: current.result.error.message }
    const members = normalized(target, [...seedViewIds, ...additions])
    const created = await target.client.presentationSave(target.projectId, presentationId, contractFor(target, members, now), 0)
    if (created.result.ok) return {
      ok: true,
      memberViewIds: [...created.result.value.state.memberViewIds],
      memberEntityRefs: uniquePresentationEntityRefs(created.result.value.state.memberEntityRefs ?? []),
    }
    if (created.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: created.result.error.message }
  } else {
    const currentView = current.result.value
    const members = normalized(target, [...currentView.state.memberViewIds, ...additions])
    const requiresReveal = additions.some((id) => currentView.state.hiddenViewIds.includes(id))
    if (sameIds(members, currentView.state.memberViewIds) && !requiresReveal) return {
      ok: true,
      memberViewIds: members,
      memberEntityRefs: uniquePresentationEntityRefs(currentView.state.memberEntityRefs ?? []),
    }
    const saved = await target.client.presentationSave(target.projectId, presentationId, {
      ...currentView,
      renderer: target.renderer,
      state: reconcileForAppend(currentView.state, members, additions),
      updatedBy: 'web',
      updatedAt: now,
    }, currentView.version)
    if (saved.result.ok) return {
      ok: true,
      memberViewIds: [...saved.result.value.state.memberViewIds],
      memberEntityRefs: uniquePresentationEntityRefs(saved.result.value.state.memberEntityRefs ?? []),
    }
    if (saved.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: saved.result.error.message }
  }

  const latest = await target.client.presentationGet(target.projectId, presentationId)
  if (!latest.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: latest.result.error.message }
  const rebasedMembers = normalized(target, [...latest.result.value.state.memberViewIds, ...additions])
  const retried = await target.client.presentationSave(target.projectId, presentationId, {
    ...latest.result.value,
    renderer: target.renderer,
    state: reconcileForAppend(latest.result.value.state, rebasedMembers, additions),
    updatedBy: 'web',
    updatedAt: new Date().toISOString(),
  }, latest.result.value.version)
  if (!retried.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: retried.result.error.message }
  return {
    ok: true,
    memberViewIds: [...retried.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(retried.result.value.state.memberEntityRefs ?? []),
  }
}

/** Remove exact View refs from a Presentation; Project Truth remains untouched. */
export async function removeProjectPresentationMembers(
  target: PresentationTarget,
  viewIds: readonly string[],
): Promise<PresentationMembersResult> {
  const removals = new Set(unique(viewIds))
  if (!removals.size) return loadProjectPresentationMembers(target)

  const presentationId = presentationIdFor(target.capability, target.ownerId)
  const current = await target.client.presentationGet(target.projectId, presentationId)
  if (!current.result.ok) {
    if (current.result.error.code === 'NOT_FOUND') return { ok: true, found: false, memberViewIds: [], memberEntityRefs: [] }
    return { ok: false, memberViewIds: [], memberEntityRefs: [], message: current.result.error.message }
  }

  const nextMembers = normalized(target, current.result.value.state.memberViewIds.filter((id) => !removals.has(id)))
  if (nextMembers.length === current.result.value.state.memberViewIds.length) return {
    ok: true,
    found: true,
    memberViewIds: nextMembers,
    memberEntityRefs: uniquePresentationEntityRefs(current.result.value.state.memberEntityRefs ?? []),
  }

  const save = async (base: PresentationViewV0, members: readonly string[]) => target.client.presentationSave(
    target.projectId,
    presentationId,
    {
      ...base,
      renderer: target.renderer,
      state: reconcilePresentationStateMembers(base.state, members),
      updatedBy: 'web',
      updatedAt: new Date().toISOString(),
    },
    base.version,
  )

  const saved = await save(current.result.value, nextMembers)
  if (saved.result.ok) return {
    ok: true,
    found: true,
    memberViewIds: [...saved.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(saved.result.value.state.memberEntityRefs ?? []),
  }
  if (saved.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: saved.result.error.message }

  const latest = await target.client.presentationGet(target.projectId, presentationId)
  if (!latest.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: latest.result.error.message }
  const rebasedMembers = normalized(target, latest.result.value.state.memberViewIds.filter((id) => !removals.has(id)))
  const retried = await save(latest.result.value, rebasedMembers)
  if (!retried.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: retried.result.error.message }
  return {
    ok: true,
    found: true,
    memberViewIds: [...retried.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(retried.result.value.state.memberEntityRefs ?? []),
  }
}

/** Append first-class aggregate entities such as Workspace/Scope without fake ArtifactViews. */
export async function appendProjectPresentationEntityRefs(
  target: PresentationTarget,
  refs: readonly PresentationEntityRefV0[],
): Promise<PresentationMembersResult> {
  const additions = uniquePresentationEntityRefs(refs)
  if (!additions.length) return loadProjectPresentationMembers(target)
  const presentationId = presentationIdFor(target.capability, target.ownerId)
  const current = await target.client.presentationGet(target.projectId, presentationId)
  const now = new Date().toISOString()
  const merge = (base: readonly PresentationEntityRefV0[]) => uniquePresentationEntityRefs([...base, ...additions])

  if (!current.result.ok) {
    if (current.result.error.code !== 'NOT_FOUND') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: current.result.error.message }
    const state = { ...emptyPresentationState([]), memberEntityRefs: merge([]) }
    const created = await target.client.presentationSave(target.projectId, presentationId, { ...contractFor(target, [], now), state }, 0)
    if (created.result.ok) return {
      ok: true,
      memberViewIds: [...created.result.value.state.memberViewIds],
      memberEntityRefs: uniquePresentationEntityRefs(created.result.value.state.memberEntityRefs ?? []),
    }
    if (created.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: created.result.error.message }
  } else {
    const nextRefs = merge(current.result.value.state.memberEntityRefs ?? [])
    if (nextRefs.length === (current.result.value.state.memberEntityRefs ?? []).length) return {
      ok: true,
      memberViewIds: [...current.result.value.state.memberViewIds],
      memberEntityRefs: nextRefs,
    }
    const saved = await target.client.presentationSave(target.projectId, presentationId, {
      ...current.result.value,
      renderer: target.renderer,
      state: { ...current.result.value.state, memberEntityRefs: nextRefs },
      updatedBy: 'web',
      updatedAt: now,
    }, current.result.value.version)
    if (saved.result.ok) return {
      ok: true,
      memberViewIds: [...saved.result.value.state.memberViewIds],
      memberEntityRefs: uniquePresentationEntityRefs(saved.result.value.state.memberEntityRefs ?? []),
    }
    if (saved.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: saved.result.error.message }
  }

  const latest = await target.client.presentationGet(target.projectId, presentationId)
  if (!latest.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: latest.result.error.message }
  const nextRefs = merge(latest.result.value.state.memberEntityRefs ?? [])
  const retried = await target.client.presentationSave(target.projectId, presentationId, {
    ...latest.result.value,
    renderer: target.renderer,
    state: { ...latest.result.value.state, memberEntityRefs: nextRefs },
    updatedBy: 'web',
    updatedAt: new Date().toISOString(),
  }, latest.result.value.version)
  if (!retried.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: retried.result.error.message }
  return {
    ok: true,
    memberViewIds: [...retried.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(retried.result.value.state.memberEntityRefs ?? []),
  }
}

/** Remove aggregate entity refs without deleting the underlying entities. */
export async function removeProjectPresentationEntityRefs(
  target: PresentationTarget,
  refs: readonly PresentationEntityRefV0[],
): Promise<PresentationMembersResult> {
  const removals = new Set(uniquePresentationEntityRefs(refs).map((ref) => `${ref.type}:${ref.id}`))
  if (!removals.size) return loadProjectPresentationMembers(target)
  const presentationId = presentationIdFor(target.capability, target.ownerId)
  const current = await target.client.presentationGet(target.projectId, presentationId)
  if (!current.result.ok) {
    if (current.result.error.code === 'NOT_FOUND') return { ok: true, found: false, memberViewIds: [], memberEntityRefs: [] }
    return { ok: false, memberViewIds: [], memberEntityRefs: [], message: current.result.error.message }
  }
  const nextRefs = uniquePresentationEntityRefs((current.result.value.state.memberEntityRefs ?? []).filter((ref) => !removals.has(`${ref.type}:${ref.id}`)))
  if (nextRefs.length === (current.result.value.state.memberEntityRefs ?? []).length) return {
    ok: true,
    found: true,
    memberViewIds: [...current.result.value.state.memberViewIds],
    memberEntityRefs: nextRefs,
  }
  const save = async (base: PresentationViewV0, entityRefs: readonly PresentationEntityRefV0[]) => target.client.presentationSave(target.projectId, presentationId, {
    ...base,
    renderer: target.renderer,
    state: { ...base.state, memberEntityRefs: uniquePresentationEntityRefs(entityRefs) },
    updatedBy: 'web',
    updatedAt: new Date().toISOString(),
  }, base.version)
  const saved = await save(current.result.value, nextRefs)
  if (saved.result.ok) return {
    ok: true,
    found: true,
    memberViewIds: [...saved.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(saved.result.value.state.memberEntityRefs ?? []),
  }
  if (saved.result.error.code !== 'STALE_PRESENTATION_VERSION') return { ok: false, memberViewIds: [], memberEntityRefs: [], message: saved.result.error.message }
  const latest = await target.client.presentationGet(target.projectId, presentationId)
  if (!latest.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: latest.result.error.message }
  const rebasedRefs = uniquePresentationEntityRefs((latest.result.value.state.memberEntityRefs ?? []).filter((ref) => !removals.has(`${ref.type}:${ref.id}`)))
  const retried = await save(latest.result.value, rebasedRefs)
  if (!retried.result.ok) return { ok: false, memberViewIds: [], memberEntityRefs: [], message: retried.result.error.message }
  return {
    ok: true,
    found: true,
    memberViewIds: [...retried.result.value.state.memberViewIds],
    memberEntityRefs: uniquePresentationEntityRefs(retried.result.value.state.memberEntityRefs ?? []),
  }
}
