import { randomUUID } from 'node:crypto'

import type {
  CurationPatchReceiptV0,
  CurationPatchStepReceiptV0,
  CurationPatchV0,
  PresentationStateV0,
} from '@local-creative-os/contracts'
import type { ProjectId, Relation, RelationId } from '@local-creative-os/domain'

import { PresentationApplicationService } from './presentation-application-service.js'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import { createTextArtifact, reviseManagedTextArtifact } from './text-artifact-service.js'

export interface CurationCommandServiceDeps {
  readonly repository: SqliteMetadataRepository
  readonly presentations: PresentationApplicationService
}

/**
 * Phase E: Agent write commands with stable receipts and clientRef mapping.
 * Owns project/scope validation and calls existing services; never writes SQL.
 */
export class CurationCommandService {
  readonly #receipts = new Map<string, CurationPatchReceiptV0>()

  constructor(private readonly deps: CurationCommandServiceDeps) {}

  async createText(projectId: string, input: { readonly scopeId: string; readonly title?: string; readonly body: string; readonly x?: number; readonly y?: number }) {
    return createTextArtifact(this.deps.repository, projectId as ProjectId, input)
  }

  async updateText(projectId: string, target: { readonly viewId?: string; readonly artifactId?: string }, body: string) {
    return reviseManagedTextArtifact(this.deps.repository, projectId as ProjectId, target, body)
  }

  async applyPatch(projectId: string, patch: CurationPatchV0): Promise<CurationPatchReceiptV0> {
    const operationId = patch.operationId ?? `curation-${randomUUID()}`
    const existing = this.#receipts.get(operationId)
    if (existing !== undefined) return existing
    const createdAt = new Date().toISOString()
    const completedSteps: CurationPatchStepReceiptV0[] = []
    const refToId = new Map<string, string>()

    const fail = (step: string, error: string): CurationPatchReceiptV0 => {
      const receipt = { schemaVersion: 0 as const, operationId, applied: false, completedSteps, failedStep: { step, error }, createdAt }
      this.#receipts.set(operationId, receipt)
      return receipt
    }

    // Pre-validate project + scope once.
    if (this.deps.repository.getProject(projectId) === undefined) return fail('validate', 'Project not found.')
    const scopeValid = this.deps.repository.get(projectId)?.scopes.some((scope) => String(scope.id) === patch.scopeId) ?? false
    if (!scopeValid) return fail('validate', 'Scope does not belong to the project.')

    // 1. createTexts
    for (const text of patch.createTexts) {
      try {
        const created = await createTextArtifact(this.deps.repository, projectId as ProjectId, {
          ...(text.title === undefined ? {} : { title: text.title }),
          body: text.body,
          scopeId: patch.scopeId,
        })
        refToId.set(text.clientRef, created.viewId)
        completedSteps.push({ step: 'createText', clientRef: text.clientRef, artifactId: created.artifactId, viewId: created.viewId, revisionId: created.revisionId })
      } catch (error: unknown) {
        return fail('createText', `${text.clientRef}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 2. relations
    for (const relation of patch.relations) {
      try {
        const fromId = this.#resolveTarget(projectId, relation.from, refToId)
        const toId = this.#resolveTarget(projectId, relation.to, refToId)
        const value: Relation = {
          id: `relation-curation-${randomUUID()}` as RelationId,
          projectId: projectId as ProjectId,
          sourceEntityType: 'view',
          sourceEntityId: fromId,
          targetEntityType: 'view',
          targetEntityId: toId,
          kind: relation.kind ?? relation.label ?? 'reference',
          ...(relation.origin === undefined ? {} : { origin: relation.origin }),
          ...(relation.createdBy === undefined ? {} : { createdBy: relation.createdBy }),
          ...(relation.confidence === undefined ? {} : { confidence: relation.confidence }),
          createdAt,
          updatedAt: createdAt,
        }
        this.deps.repository.upsertRelation(value)
        completedSteps.push({ step: 'relation', relationId: value.id })
      } catch (error: unknown) {
        return fail('relation', error instanceof Error ? error.message : String(error))
      }
    }

    // 3. presentation
    if (patch.presentation !== undefined) {
      try {
        const current = this.deps.presentations.get(projectId, patch.presentation.presentationId)
        if (current === undefined) return fail('presentation', 'Presentation not found.')
        if (current.version !== patch.presentation.expectedVersion) {
          return fail('presentation', `STALE_PRESENTATION_VERSION current=${current.version}`)
        }
        const next = this.#applyPresentationPatch(current.state, patch.presentation, refToId)
        this.deps.presentations.save(projectId, {
          presentationId: current.id,
          scopeId: current.scopeId,
          capability: current.capability,
          renderer: patch.presentation.setRenderer ?? current.renderer,
          state: next,
          expectedVersion: current.version,
          updatedBy: 'agent',
        })
        completedSteps.push({ step: 'presentation' })
      } catch (error: unknown) {
        return fail('presentation', error instanceof Error ? error.message : String(error))
      }
    }

    const receipt: CurationPatchReceiptV0 = { schemaVersion: 0, operationId, applied: true, completedSteps, createdAt }
    this.#receipts.set(operationId, receipt)
    return receipt
  }

  #resolveTarget(projectId: string, target: { readonly clientRef?: string; readonly entityType?: string; readonly entityId?: string }, refToId: Map<string, string>): string {
    if (target.clientRef !== undefined) {
      const mapped = refToId.get(target.clientRef)
      if (mapped === undefined) throw new Error(`clientRef ${target.clientRef} has no created view yet.`)
      return mapped
    }
    if (target.entityId !== undefined) return target.entityId
    throw new Error('Relation target requires clientRef or entityId.')
  }

  #applyPresentationPatch(
    state: PresentationStateV0,
    patch: CurationPatchV0['presentation'],
    refToId: Map<string, string>,
  ): PresentationStateV0 {
    let memberViewIds = [...state.memberViewIds]
    const resolve = (target: { readonly clientRef?: string; readonly entityType?: string; readonly entityId?: string }): string => {
      if (target.clientRef !== undefined) {
        const mapped = refToId.get(target.clientRef)
        if (mapped === undefined) throw new Error(`clientRef ${target.clientRef} has no created view yet.`)
        return mapped
      }
      if (target.entityId !== undefined) return target.entityId
      throw new Error('Member ref requires clientRef or entityId.')
    }
    for (const member of patch?.addMembers ?? []) {
      const id = resolve(member)
      if (!memberViewIds.includes(id)) memberViewIds.push(id)
    }
    const removed = new Set(patch?.removeMembers ?? [])
    memberViewIds = memberViewIds.filter((id) => !removed.has(id))
    const members = new Set(memberViewIds)
    const hiddenViewIds = state.hiddenViewIds
    const positions = state.positions
    let hierarchy = state.hierarchy
    if (patch?.setHierarchy !== undefined) {
      hierarchy = {
        parentByViewId: Object.fromEntries(Object.entries(patch.setHierarchy.parentByViewId).filter(([id]) => members.has(id))),
        orderByParent: Object.fromEntries(Object.entries(patch.setHierarchy.orderByParent).map(([parent, children]) => [parent, children.filter((id) => members.has(id))])),
      }
    }
    let presentationEdges = [...state.presentationEdges]
    for (const edge of patch?.addPresentationEdges ?? []) {
      const from = resolve(edge.from)
      const to = resolve(edge.to)
      if (!members.has(from) || !members.has(to)) throw new Error('Presentation edge endpoints must be members.')
      presentationEdges = [...presentationEdges.filter((item) => item.id !== edge.id), { id: edge.id, fromViewId: from, toViewId: to, ...(edge.label === undefined ? {} : { label: edge.label }) }]
    }
    const removedEdges = new Set(patch?.removePresentationEdges ?? [])
    presentationEdges = presentationEdges.filter((edge) => !removedEdges.has(edge.id))
    let pinnedViewIds = [...state.pinnedViewIds]
    for (const id of patch?.pin ?? []) if (!pinnedViewIds.includes(id)) pinnedViewIds.push(id)
    const unpinned = new Set(patch?.unpin ?? [])
    pinnedViewIds = pinnedViewIds.filter((id) => !unpinned.has(id))
    return {
      memberViewIds,
      hiddenViewIds,
      positions,
      hierarchy,
      presentationEdges,
      pinnedViewIds,
      emphasisByViewId: { ...state.emphasisByViewId, ...(patch?.setEmphasis ?? {}) },
    }
  }
}
