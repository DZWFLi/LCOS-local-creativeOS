import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PresentationCapabilityV0, PresentationEntityRefV0, PresentationStateV0, PresentationViewV0 } from '@local-creative-os/contracts'

import type { LocalCoreClient } from '../runtime/localCoreClient'
import { subscribeProjectRealtime } from '../runtime/projectRealtime'
import { nextMutationOrigin } from '../runtime/mutationIdentity'

/**
 * Phase B Presentation persistence facade.
 *
 * One PresentationView per (project, scope, capability) with stable id
 * `presentation:<capability>:<scopeId>`. The session core is deliberately
 * React-free so it can be unit tested with a fake client; the hook is a thin
 * shell. Existing memory stores (presentationDraftState / hierarchy) keep
 * working and mirror their state through the module bridge.
 */

export const presentationIdFor = (capability: string, scopeId: string): string => `presentation:${capability}:${scopeId}`

export const emptyPresentationState = (memberViewIds: readonly string[] = []): PresentationStateV0 => ({
  memberViewIds: [...memberViewIds],
  hiddenViewIds: [],
  positions: {},
  hierarchy: { parentByViewId: {}, orderByParent: {} },
  presentationEdges: [],
  pinnedViewIds: [],
  emphasisByViewId: {},
})

/** Keep every Presentation-local structure consistent with one exact member set.
 * This is especially important when R3.1-A migrates legacy Context clone ids to
 * canonical Project View ids: stale hierarchy/track metadata must never make the
 * exact membership save invalid or keep removed nodes visually alive. */
export function reconcilePresentationStateMembers(state: PresentationStateV0, memberViewIds: readonly string[]): PresentationStateV0 {
  const members = new Set(memberViewIds)
  return {
    ...state,
    memberViewIds: [...memberViewIds],
    hiddenViewIds: state.hiddenViewIds.filter((id) => members.has(id)),
    positions: Object.fromEntries(Object.entries(state.positions).filter(([id]) => members.has(id))),
    ...(state.layoutMode === undefined ? {} : { layoutMode: state.layoutMode }),
    ...(state.gridLayout === undefined ? {} : {
      gridLayout: { ...state.gridLayout, order: state.gridLayout.order.filter((id) => members.has(id)) },
    }),
    hierarchy: {
      parentByViewId: Object.fromEntries(Object.entries(state.hierarchy.parentByViewId)
        .filter(([id]) => members.has(id))
        .map(([id, parentId]) => [id, parentId !== null && members.has(parentId) ? parentId : null])),
      orderByParent: Object.fromEntries(Object.entries(state.hierarchy.orderByParent)
        .filter(([parentId]) => parentId === '' || members.has(parentId))
        .map(([parentId, children]) => [parentId, children.filter((id) => members.has(id))])),
    },
    presentationEdges: state.presentationEdges.filter((edge) => members.has(edge.fromViewId) && members.has(edge.toViewId)),
    pinnedViewIds: state.pinnedViewIds.filter((id) => members.has(id)),
    emphasisByViewId: Object.fromEntries(Object.entries(state.emphasisByViewId).filter(([id]) => members.has(id))),
    ...(state.trackSegments === undefined ? {} : {
      trackSegments: state.trackSegments
        .map((segment) => ({ ...segment, memberViewIds: segment.memberViewIds.filter((id) => members.has(id)) }))
        .filter((segment) => segment.memberViewIds.length > 0)
        .map((segment, order) => ({ ...segment, order })),
    }),
    ...(state.workflowOperators === undefined ? {} : {
      workflowOperators: Object.fromEntries(Object.entries(state.workflowOperators).filter(([id]) => members.has(id))),
    }),
    ...(state.workflowActions === undefined ? {} : {
      workflowActions: state.workflowActions.map((action) => ({
        ...action,
        attachedViewIds: action.attachedViewIds.filter((id) => members.has(id)),
      })),
    }),
    ...(state.workflowActionEdges === undefined ? {} : {
      workflowActionEdges: state.workflowActionEdges.filter((edge) => {
        const actionIds = new Set((state.workflowActions ?? []).map((action) => action.id))
        return actionIds.has(edge.fromActionId) && actionIds.has(edge.toActionId)
      }),
    }),
  }
}

export interface PresentationViewSessionDeps {
  readonly client: LocalCoreClient
  readonly projectId: string
  readonly scopeId: string
  readonly capability: PresentationCapabilityV0
  readonly renderer: string
  readonly seedState?: (existing: PresentationViewV0 | null) => PresentationStateV0
  readonly now?: () => string
}

export interface PresentationViewSession {
  readonly view: PresentationViewV0 | null
  readonly ready: boolean
  load(): Promise<void>
  patch(mutator: (state: PresentationStateV0) => PresentationStateV0): void
  flush(): Promise<void>
  applyRemote(view: PresentationViewV0): void
  subscribe(listener: () => void): () => void
}

const SAVE_DEBOUNCE_MS = 500

export class PresentationViewSessionCore implements PresentationViewSession {
  view: PresentationViewV0 | null = null
  ready = false
  #committedView: PresentationViewV0 | null = null
  #listeners = new Set<() => void>()
  #pending: ((state: PresentationStateV0) => PresentationStateV0) | null = null
  #flushing = false

  constructor(private readonly deps: PresentationViewSessionDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #changed(): void {
    for (const listener of this.#listeners) {
      try { listener() } catch { /* listener errors never break persistence */ }
    }
  }

  #setCommitted(view: PresentationViewV0): void {
    this.#committedView = view
    this.view = this.#pending === null
      ? view
      : { ...view, state: this.#pending(view.state) }
    this.ready = true
    this.#changed()
  }

  #markWriteUncertain(mutator: (state: PresentationStateV0) => PresentationStateV0): void {
    // A transport timeout is not proof that the server rejected the write.
    // Preserve the user's intent over committed truth so a later authoritative
    // snapshot can rebase it; never silently discard an edit with unknown outcome.
    const later = this.#pending
    this.#pending = later === null ? mutator : (state) => later(mutator(state))
    this.view = this.#committedView === null ? null : { ...this.#committedView, state: this.#pending(this.#committedView.state) }
    this.ready = this.#committedView !== null
    this.#changed()
    emitPresentationPersistenceNotice('保存结果暂时无法确认；操作已保留，连接恢复后会重新校准')
  }

  async load(): Promise<void> {
    const { client, projectId, scopeId, capability, renderer, seedState } = this.deps
    const presentationId = presentationIdFor(capability, scopeId)
    const call = await client.presentationGet(projectId, presentationId)
    if (call.result.ok) {
      this.#setCommitted(call.result.value)
      return
    }
    if (call.result.error.code === 'NOT_FOUND' && seedState !== undefined) {
      const now = this.deps.now?.() ?? new Date().toISOString()
      const contract: PresentationViewV0 = {
        schemaVersion: 0,
        id: presentationId,
        projectId,
        scopeId,
        capability,
        renderer,
        state: seedState(null),
        version: 0,
        updatedBy: 'web',
        createdAt: now,
        updatedAt: now,
      }
      const created = await client.presentationSave(projectId, presentationId, contract, 0)
      if (created.result.ok) {
        this.#setCommitted(created.result.value)
        return
      }
      if (created.result.error.code === 'STALE_PRESENTATION_VERSION') {
        // Another writer created the same Presentation first. Load that durable
        // view instead of falling back to a browser-only second truth.
        const latest = await client.presentationGet(projectId, presentationId)
        if (latest.result.ok) {
          this.#setCommitted(latest.result.value)
          return
        }
      }
    }
    this.ready = false
    this.view = this.#committedView
    this.#changed()
    emitPresentationPersistenceNotice('画布组织状态暂时只读：本地 Core 无法确认持久化状态')
  }

  patch(mutator: (state: PresentationStateV0) => PresentationStateV0): void {
    if (!this.ready || this.view === null || this.#committedView === null) return
    // Compose intent against the committed base. `view` is only the optimistic
    // projection; flush must never replay a mutator onto an already-mutated view.
    const previous = this.#pending
    this.#pending = previous === null ? mutator : (state) => mutator(previous(state))
    this.view = { ...this.view, state: mutator(this.view.state) }
    this.#changed()
  }

  async flush(): Promise<void> {
    if (this.#flushing || !this.ready) return
    this.#flushing = true
    try {
      // Drain every intent that arrived while a prior save was in flight. This
      // prevents a fast second drag/pin edit from being stranded behind `#flushing`.
      while (this.#pending !== null && this.#committedView !== null) {
        const mutator = this.#pending
        this.#pending = null
        const base = this.#committedView
        const { client, projectId, scopeId, capability, renderer } = this.deps
        const now = this.deps.now?.() ?? new Date().toISOString()
        const contract: PresentationViewV0 = {
          ...base,
          scopeId,
          capability,
          renderer,
          state: mutator(base.state),
          updatedBy: 'web',
          updatedAt: now,
        }
        const origin = nextMutationOrigin(capability)
        const saved = await client.presentationSave(projectId, base.id, contract, base.version, undefined, origin)
        if (saved.result.ok) {
          this.#setCommitted(saved.result.value)
          continue
        }
        const receipt = await client.mutationReceipt(projectId, origin.operationId).catch(() => null)
        if (receipt?.result.ok) {
          this.#setCommitted(receipt.result.value.response as PresentationViewV0)
          continue
        }
        if (saved.result.error.code === 'STALE_PRESENTATION_VERSION') {
          // Rebase the *captured intent* once on the latest committed state.
          const latest = await client.presentationGet(projectId, base.id)
          if (latest.result.ok) {
            const retried = await client.presentationSave(projectId, base.id, {
              ...latest.result.value,
              scopeId,
              capability,
              renderer,
              state: mutator(latest.result.value.state),
              updatedBy: 'web',
              updatedAt: now,
            }, latest.result.value.version)
            if (retried.result.ok) {
              this.#setCommitted(retried.result.value)
              continue
            }
          }
        }
        this.#markWriteUncertain(mutator)
        break
      }
    } finally {
      this.#flushing = false
    }
  }

  applyRemote(view: PresentationViewV0): void {
    // Remote committed truth becomes the new base. Any local intent that arrived
    // concurrently is re-projected on top and will be CAS-saved by the drain.
    if (this.#committedView !== null && view.version <= this.#committedView.version) return
    this.#setCommitted(view)
  }
}

function emitPresentationPersistenceNotice(message: string): void {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  window.dispatchEvent(new CustomEvent('lcos:presentation-persistence', { detail: { message } }))
}

// ---- Module-level bridge (memory stores mirror into the active session) ----

export interface PresentationBridge {
  readonly ready: boolean
  readonly state: PresentationStateV0 | null
  patch(mutator: (state: PresentationStateV0) => PresentationStateV0): void
  flushSoon(): void
  subscribe(listener: () => void): () => void
}

const bridges = new Map<string, PresentationBridge>()
const bridgeListeners = new Map<string, Set<() => void>>()

export const presentationBridgeKey = (projectId: string, scopeId: string, capability: string): string => `${projectId}::${scopeId}::${capability}`

export function registerPresentationBridge(projectId: string, scopeId: string, capability: string, bridge: PresentationBridge): void {
  bridges.set(presentationBridgeKey(projectId, scopeId, capability), bridge)
  bridgeListeners.get(presentationBridgeKey(projectId, scopeId, capability))?.forEach((listener) => {
    try { listener() } catch { /* 注册通知不影响调用方 */ }
  })
}

export function unregisterPresentationBridge(projectId: string, scopeId: string, capability: string): void {
  bridges.delete(presentationBridgeKey(projectId, scopeId, capability))
  bridgeListeners.get(presentationBridgeKey(projectId, scopeId, capability))?.forEach((listener) => {
    try { listener() } catch { /* 注销通知不影响调用方 */ }
  })
}

export function getPresentationBridge(projectId: string, scopeId: string, capability: string): PresentationBridge | undefined {
  return bridges.get(presentationBridgeKey(projectId, scopeId, capability))
}

/** 订阅某 presentation bridge 的注册/注销事件（解决子组件先于父组件挂载导致的恢复丢失）。 */
export function subscribePresentationBridge(key: string, listener: () => void): () => void {
  let set = bridgeListeners.get(key)
  if (set === undefined) {
    set = new Set()
    bridgeListeners.set(key, set)
  }
  set.add(listener)
  return () => {
    const current = bridgeListeners.get(key)
    if (current === undefined) return
    current.delete(listener)
    if (current.size === 0) bridgeListeners.delete(key)
  }
}

export const capabilityForRenderer = (renderer: string): PresentationCapabilityV0 => {
  if (renderer.startsWith('context-')) return 'context'
  if (renderer === 'workflow') return 'workflow'
  if (renderer === 'arrange') return 'arrange'
  return 'custom'
}

// ---- React hook ----

export function usePresentationViewBridge(deps: Omit<PresentationViewSessionDeps, 'client' | 'now'> & { readonly client: LocalCoreClient | null }): PresentationBridge {
  const enabled = deps.client !== null
  const [, force] = useState(0)
  // Session identity is the durable Presentation identity. Recreate the session
  // whenever project/scope/capability/renderer changes; never register an A
  // session under B's bridge key after navigation.
  const session = useMemo(() => {
    if (deps.client === null) return null
    return new PresentationViewSessionCore({
      client: deps.client,
      projectId: deps.projectId,
      scopeId: deps.scopeId,
      capability: deps.capability,
      renderer: deps.renderer,
      seedState: deps.seedState,
      now: () => new Date().toISOString(),
    })
  }, [deps.client, deps.projectId, deps.scopeId, deps.capability, deps.renderer]) // seedState is only used for first creation; identity changes recreate the session.

  const flushTimerRef = useRef<number | null>(null)
  const patch = useCallback((mutator: (state: PresentationStateV0) => PresentationStateV0) => { session?.patch(mutator) }, [session])
  const flushSoon = useCallback(() => {
    if (session === null || typeof window === 'undefined') return
    if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current)
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      void session.flush()
    }, SAVE_DEBOUNCE_MS)
  }, [session])

  useEffect(() => {
    if (!enabled || session === null || deps.client === null) return
    const unsubscribe = session.subscribe(() => force((value) => value + 1))
    const client = deps.client
    const { projectId, scopeId, capability } = deps
    const presentationId = presentationIdFor(capability, scopeId)
    let cancelled = false
    void session.load()
    const unsubscribeProjectStream = subscribeProjectRealtime(client, projectId, (message) => {
      const changes = message.kind === 'snapshot'
        ? message.snapshot?.presentations ?? []
        : message.event?.type === 'presentation.changed' ? [message.event.payload as { presentationId: string; version: number }] : []
      for (const change of changes) {
        if (cancelled || change.presentationId !== presentationId) continue
        if (session.view !== null && session.view.version >= change.version) continue
        void client.presentationGet(projectId, presentationId).then((call) => {
          if (cancelled || !call.result.ok) return
          session.applyRemote(call.result.value)
        })
      }
    })
    registerPresentationBridge(projectId, scopeId, capability, {
      get ready() { return session.ready },
      get state() { return session.view?.state ?? null },
      patch: (mutator) => session.patch(mutator),
      flushSoon,
      subscribe: (listener) => session.subscribe(listener),
    })
    return () => {
      cancelled = true
      unsubscribeProjectStream()
      if (flushTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      unsubscribe()
      unregisterPresentationBridge(projectId, scopeId, capability)
    }
  }, [enabled, deps.client, deps.capability, deps.projectId, deps.scopeId, flushSoon, session])

  return {
    get ready() { return session?.ready ?? false },
    get state() { return session?.view?.state ?? null },
    patch,
    flushSoon,
    subscribe: (listener) => session?.subscribe(listener) ?? (() => undefined),
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export interface PresentationMembershipOptions {
  readonly projectId: string
  readonly scopeId: string
  readonly capability: 'context' | 'workflow' | 'custom'
  readonly renderer: string
  readonly client: LocalCoreClient | null
  readonly members: readonly string[]
  readonly setMembers: (ids: string[]) => void
  readonly seedMembers: () => string[]
  /** First-class aggregate entities (Workspace / Scope) referenced by the same Presentation. */
  readonly entityRefs?: readonly PresentationEntityRefV0[]
  readonly setEntityRefs?: (refs: PresentationEntityRefV0[]) => void
  readonly seedEntityRefs?: () => PresentationEntityRefV0[]
  /** Optional migration/identity normalizer before membership reaches the UI. */
  readonly normalizeMembers?: (ids: readonly string[]) => string[]
}

/**
 * Phase B (B9): Context / Workflow membership persistence.
 * - First run: resolver seed creates the PresentationView once.
 * - Later: persisted memberViewIds restore the React state on reload.
 * - User edits are written through (debounced) without changing React ownership.
 */
export function usePresentationMembership(options: PresentationMembershipOptions): void {
  const bridge = usePresentationViewBridge({
    client: options.client,
    projectId: options.projectId,
    scopeId: options.scopeId,
    capability: options.capability,
    renderer: options.renderer,
    seedState: () => ({ ...emptyPresentationState(options.seedMembers()), memberEntityRefs: options.seedEntityRefs?.() ?? [] }),
  })
  const membersRef = useRef(options.members)
  membersRef.current = options.members
  // When committed Core state restores/changes remotely, skip the corresponding
  // local write-back render. Without this guard a restore can immediately patch
  // the stale pre-restore React value back into Core.
  const restoringMembersRef = useRef<readonly string[] | null>(null)

  const entityRefsRef = useRef(options.entityRefs ?? [])
  entityRefsRef.current = options.entityRefs ?? []
  const restoringEntityRefsRef = useRef<readonly PresentationEntityRefV0[] | null>(null)
  const persistedEntityRefs = bridge.state?.memberEntityRefs ?? null
  const entityRefKey = (ref: PresentationEntityRefV0) => `${ref.type}:${ref.id}`
  const normalizeEntityRefs = (refs: readonly PresentationEntityRefV0[]) => {
    const seen = new Set<string>()
    return refs.flatMap((ref) => {
      const key = entityRefKey(ref)
      if (!ref.id || seen.has(key)) return []
      seen.add(key)
      return [{ type: ref.type, id: ref.id } satisfies PresentationEntityRefV0]
    })
  }
  const sameEntityRefs = (left: readonly PresentationEntityRefV0[], right: readonly PresentationEntityRefV0[]) => {
    const a = normalizeEntityRefs(left).map(entityRefKey)
    const b = normalizeEntityRefs(right).map(entityRefKey)
    return a.length === b.length && a.every((key, index) => key === b[index])
  }

  const persistedMembersRaw = bridge.state?.memberViewIds ?? null
  const persistedMembers = persistedMembersRaw === null
    ? null
    : (options.normalizeMembers?.(persistedMembersRaw) ?? [...persistedMembersRaw])

  useEffect(() => {
    if (!bridge.ready || persistedMembers === null || persistedMembersRaw === null) return
    if (!sameIds(persistedMembersRaw, persistedMembers)) {
      bridge.patch((state) => reconcilePresentationStateMembers(state, persistedMembers))
      bridge.flushSoon()
    }
    if (!sameIds(persistedMembers, membersRef.current)) {
      restoringMembersRef.current = [...persistedMembers]
      // A committed empty member list is still authoritative.
      options.setMembers([...persistedMembers])
    }
  }, [bridge.ready, persistedMembers, persistedMembersRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bridge.ready || bridge.state === null) return
    const restoring = restoringMembersRef.current
    if (restoring !== null) {
      if (sameIds(restoring, options.members)) restoringMembersRef.current = null
      return
    }
    const normalizedMembers = options.normalizeMembers?.(options.members) ?? [...options.members]
    if (sameIds(bridge.state.memberViewIds, normalizedMembers)) return
    bridge.patch((state) => reconcilePresentationStateMembers(state, normalizedMembers))
    bridge.flushSoon()
  }, [bridge.ready, options.members, persistedMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bridge.ready || persistedEntityRefs === null || !options.setEntityRefs) return
    const normalized = normalizeEntityRefs(persistedEntityRefs)
    if (!sameEntityRefs(normalized, entityRefsRef.current)) {
      restoringEntityRefsRef.current = normalized
      options.setEntityRefs(normalized)
    }
  }, [bridge.ready, persistedEntityRefs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bridge.ready || bridge.state === null || options.entityRefs === undefined) return
    const restoring = restoringEntityRefsRef.current
    if (restoring !== null) {
      if (sameEntityRefs(restoring, options.entityRefs)) restoringEntityRefsRef.current = null
      return
    }
    const normalized = normalizeEntityRefs(options.entityRefs)
    if (sameEntityRefs(bridge.state.memberEntityRefs ?? [], normalized)) return
    bridge.patch((state) => ({ ...state, memberEntityRefs: normalized }))
    bridge.flushSoon()
  }, [bridge.ready, options.entityRefs, persistedEntityRefs]) // eslint-disable-line react-hooks/exhaustive-deps
}
