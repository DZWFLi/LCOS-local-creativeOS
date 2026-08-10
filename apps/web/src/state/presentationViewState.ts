import { useCallback, useEffect, useRef, useState } from 'react'

import type { PresentationCapabilityV0, PresentationStateV0, PresentationViewV0 } from '@local-creative-os/contracts'

import type { LocalCoreClient } from '../runtime/localCoreClient'

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

  async load(): Promise<void> {
    const { client, projectId, scopeId, capability, renderer, seedState } = this.deps
    const presentationId = presentationIdFor(capability, scopeId)
    const call = await client.presentationGet(projectId, presentationId)
    if (call.result.ok) {
      this.view = call.result.value
      this.ready = true
      this.#changed()
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
        this.view = created.result.value
        this.ready = true
        this.#changed()
        return
      }
      if (created.result.error.code !== 'STALE_PRESENTATION_VERSION') {
        // Core unavailable or validation failure → keep memory fallback active.
        this.ready = false
        this.#changed()
        return
      }
    }
    // Existing view appeared concurrently or Core is unavailable: fall back to memory.
    this.ready = false
    this.#changed()
  }

  patch(mutator: (state: PresentationStateV0) => PresentationStateV0): void {
    if (this.view === null) return
    this.#pending = mutator
    const next = mutator(this.view.state)
    this.view = { ...this.view, state: next }
    this.#changed()
  }

  async flush(): Promise<void> {
    if (this.#flushing) return
    this.#flushing = true
    try {
      const mutator = this.#pending
      if (mutator === null || this.view === null) return
      this.#pending = null
      const { client, projectId, scopeId, capability, renderer } = this.deps
      const now = this.deps.now?.() ?? new Date().toISOString()
      const before = this.view
      const contract: PresentationViewV0 = {
        ...before,
        scopeId,
        capability,
        renderer,
        state: mutator(before.state),
        updatedBy: 'web',
        updatedAt: now,
      }
      const saved = await client.presentationSave(projectId, before.id, contract, before.version)
      if (saved.result.ok) {
        this.view = saved.result.value
        this.#changed()
        return
      }
      if (saved.result.error.code === 'STALE_PRESENTATION_VERSION') {
        // CAS retry once: reload latest, re-apply pending intent, then save again.
        const latest = await client.presentationGet(projectId, before.id)
        if (latest.result.ok) {
          this.view = latest.result.value
          const retried = await client.presentationSave(projectId, before.id, {
            ...latest.result.value,
            state: mutator(latest.result.value.state),
            updatedBy: 'web',
            updatedAt: now,
          }, latest.result.value.version)
          if (retried.result.ok) this.view = retried.result.value
        }
        this.#changed()
        return
      }
      // Other failures: keep optimistic state; a later flush can retry.
      this.#pending = mutator
      this.#changed()
    } finally {
      this.#flushing = false
    }
  }

  applyRemote(view: PresentationViewV0): void {
    this.view = view
    this.ready = true
    this.#changed()
  }
}

// ---- Module-level bridge (memory stores mirror into the active session) ----

export interface PresentationBridge {
  readonly ready: boolean
  readonly state: PresentationStateV0 | null
  patch(mutator: (state: PresentationStateV0) => PresentationStateV0): void
  flushSoon(): void
}

const bridges = new Map<string, PresentationBridge>()

export const presentationBridgeKey = (projectId: string, scopeId: string, capability: string): string => `${projectId}::${scopeId}::${capability}`

export function registerPresentationBridge(projectId: string, scopeId: string, capability: string, bridge: PresentationBridge): void {
  bridges.set(presentationBridgeKey(projectId, scopeId, capability), bridge)
}

export function unregisterPresentationBridge(projectId: string, scopeId: string, capability: string): void {
  bridges.delete(presentationBridgeKey(projectId, scopeId, capability))
}

export function getPresentationBridge(projectId: string, scopeId: string, capability: string): PresentationBridge | undefined {
  return bridges.get(presentationBridgeKey(projectId, scopeId, capability))
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
  const sessionRef = useRef<PresentationViewSessionCore | null>(null)
  if (enabled && sessionRef.current === null) {
    sessionRef.current = new PresentationViewSessionCore({ ...deps, client: deps.client!, now: () => new Date().toISOString() })
  }
  const session = sessionRef.current
  const patch = useCallback((mutator: (state: PresentationStateV0) => PresentationStateV0) => { session?.patch(mutator) }, [session])
  const flushSoon = useCallback(() => { if (session !== null) window.setTimeout(() => { void session.flush() }, SAVE_DEBOUNCE_MS) }, [session])

  useEffect(() => {
    if (!enabled || session === null || deps.client === null) return
    const controller = new AbortController()
    void session.load()
    const unsubscribe = session.subscribe(() => force((value) => value + 1))
    const client = deps.client
    const { projectId, scopeId, capability } = deps
    const presentationId = presentationIdFor(capability, scopeId)
    let cancelled = false
    void client.streamPresentation(projectId, presentationId, undefined, {
      onChange: (change) => {
        if (cancelled) return
        // Remote change with a higher version and no local pending intent → reload latest.
        if (session.view === null || session.view.version >= change.version) return
        void client.presentationGet(projectId, presentationId).then((call) => {
          if (cancelled || !call.result.ok) return
          session.applyRemote(call.result.value)
        })
      },
    }, controller.signal).catch(() => {
      // SSE is best-effort; the next page load or local save reconciles state.
    })
    registerPresentationBridge(projectId, scopeId, capability, {
      get ready() { return session.ready },
      get state() { return session.view?.state ?? null },
      patch: (mutator) => session.patch(mutator),
      flushSoon: () => { window.setTimeout(() => { void session.flush() }, SAVE_DEBOUNCE_MS) },
    })
    return () => {
      cancelled = true
      controller.abort()
      unsubscribe()
      unregisterPresentationBridge(projectId, scopeId, capability)
    }
  }, [enabled, deps.capability, deps.projectId, deps.renderer, deps.scopeId, session])

  return {
    get ready() { return session?.ready ?? false },
    get state() { return session?.view?.state ?? null },
    patch,
    flushSoon,
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export interface PresentationMembershipOptions {
  readonly projectId: string
  readonly scopeId: string
  readonly capability: 'context' | 'workflow'
  readonly renderer: string
  readonly client: LocalCoreClient | null
  readonly members: readonly string[]
  readonly setMembers: (ids: string[]) => void
  readonly seedMembers: () => string[]
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
    seedState: () => emptyPresentationState(options.seedMembers()),
  })
  const membersRef = useRef(options.members)
  membersRef.current = options.members

  useEffect(() => {
    if (!bridge.ready || bridge.state === null) return
    const persisted = bridge.state.memberViewIds
    if (persisted.length > 0 && !sameIds(persisted, membersRef.current)) {
      options.setMembers(persisted)
    }
  }, [bridge.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bridge.ready || bridge.state === null) return
    if (sameIds(bridge.state.memberViewIds, options.members)) return
    bridge.patch((state) => ({ ...state, memberViewIds: [...options.members] }))
    bridge.flushSoon()
  }, [bridge.ready, options.members]) // eslint-disable-line react-hooks/exhaustive-deps
}
