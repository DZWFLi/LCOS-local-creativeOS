import type { PresentationStateV0, PresentationViewV0 } from '@local-creative-os/contracts'

import type { SqliteMetadataRepository } from './metadata-repository.js'
import type { PresentationRepository } from './presentation-repository.js'

/**
 * PresentationApplicationService — Phase B implementation.
 *
 * Presentation owns membership / position / hierarchy / display relation /
 * manual anchor / emphasis / renderer ONLY. It never owns business truth and
 * it never bumps project graphVersion.
 * Routes must not orchestrate presentation logic inline.
 */
export class PresentationConflictError extends Error {
  readonly code = 'STALE_PRESENTATION_VERSION'
  constructor(readonly currentVersion: number) {
    super(`Presentation version conflict: current version is ${currentVersion}.`)
  }
}

export interface PresentationSaveInput {
  readonly presentationId: string
  readonly scopeId: string
  readonly capability: PresentationViewV0['capability']
  readonly renderer: string
  readonly state: PresentationStateV0
  readonly expectedVersion: number
  readonly updatedBy: PresentationViewV0['updatedBy']
}

export type PresentationChangeListener = (value: { readonly presentationId: string; readonly version: number; readonly updatedAt: string; readonly updatedBy: PresentationViewV0['updatedBy'] }) => void

export class PresentationApplicationService {
  readonly #listeners = new Map<string, Set<PresentationChangeListener>>()

  constructor(
    private readonly repository: PresentationRepository,
    private readonly metadata: SqliteMetadataRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  list(projectId: string): readonly PresentationViewV0[] {
    return this.repository.listPresentationViews(projectId)
  }

  get(projectId: string, presentationId: string): PresentationViewV0 | undefined {
    return this.repository.getPresentationView(projectId, presentationId)
  }

  save(projectId: string, input: PresentationSaveInput): PresentationViewV0 {
    if (this.metadata.getProject(projectId) === undefined) throw new Error('Project not found.')
    const scope = this.metadata.get(projectId)?.scopes.some((item) => String(item.id) === input.scopeId) ?? false
    if (!scope) throw new Error('Scope does not belong to the project.')
    this.#validateState(projectId, input.state)

    const now = this.now()
    const existing = this.repository.getPresentationView(projectId, input.presentationId)
    const view: PresentationViewV0 = {
      schemaVersion: 0,
      id: input.presentationId,
      projectId,
      scopeId: input.scopeId,
      capability: input.capability,
      renderer: input.renderer,
      state: input.state,
      version: existing === undefined ? 0 : existing.version + 1,
      updatedBy: input.updatedBy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (existing === undefined) {
      if (input.expectedVersion !== 0) throw new PresentationConflictError(0)
      this.repository.insertPresentationView(view)
    } else {
      const result = this.repository.compareAndSwapPresentationView(view, input.expectedVersion)
      if (!result.updated) throw new PresentationConflictError(result.currentVersion)
    }
    this.#notify(projectId, input.presentationId, view)
    return view
  }

  delete(projectId: string, presentationId: string): void {
    this.repository.deletePresentationView(projectId, presentationId)
    this.#notify(projectId, presentationId, { presentationId, version: -1, updatedAt: this.now(), updatedBy: 'core' })
  }

  subscribe(projectId: string, presentationId: string, listener: PresentationChangeListener): () => void {
    const key = `${projectId}::${presentationId}`
    let set = this.#listeners.get(key)
    if (set === undefined) {
      set = new Set()
      this.#listeners.set(key, set)
    }
    set.add(listener)
    return () => {
      const current = this.#listeners.get(key)
      if (current === undefined) return
      current.delete(listener)
      if (current.size === 0) this.#listeners.delete(key)
    }
  }

  #notify(projectId: string, presentationId: string, value: { readonly version: number; readonly updatedAt: string; readonly updatedBy: PresentationViewV0['updatedBy'] }): void {
    const set = this.#listeners.get(`${projectId}::${presentationId}`)
    if (set === undefined) return
    for (const listener of set) {
      try { listener({ presentationId, ...value }) } catch { /* listener errors never break the save */ }
    }
  }

  #validateState(projectId: string, state: PresentationStateV0): void {
    const members = new Set(state.memberViewIds)
    for (const viewId of members) {
      const view = this.metadata.getArtifactView(viewId)
      if (view === undefined || String(this.metadata.getArtifact(String(view.artifactId))?.projectId ?? '') !== projectId) {
        throw new Error(`Presentation member ${viewId} does not belong to the project.`)
      }
    }
    for (const [viewId, parentId] of Object.entries(state.hierarchy.parentByViewId)) {
      if (!members.has(viewId)) throw new Error(`Hierarchy references non-member ${viewId}.`)
      if (parentId !== null && !members.has(parentId)) throw new Error(`Hierarchy parent ${parentId} is not a member.`)
    }
    for (const [parentId, order] of Object.entries(state.hierarchy.orderByParent)) {
      if (parentId !== '' && !members.has(parentId)) throw new Error(`Hierarchy order references non-member ${parentId}.`)
      for (const childId of order) {
        if (!members.has(childId)) throw new Error(`Hierarchy order child ${childId} is not a member.`)
      }
    }
    for (const edge of state.presentationEdges) {
      if (!members.has(edge.fromViewId)) throw new Error(`Presentation edge ${edge.id} references non-member ${edge.fromViewId}.`)
      if (!members.has(edge.toViewId)) throw new Error(`Presentation edge ${edge.id} references non-member ${edge.toViewId}.`)
    }
  }
}
