import { randomUUID } from 'node:crypto'
import type { PresentationViewV0, ReorganizePreviewV0, ReorganizeProposalV0 } from '@local-creative-os/contracts'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import { PresentationApplicationService } from './presentation-application-service.js'

export interface CreateReorganizeProposalInputV0 {
  readonly projectId: string
  readonly presentationId: string
  readonly baseVersion: number
  readonly mergeCandidates?: ReorganizeProposalV0['mergeCandidates']
  readonly removeMemberViewIds?: readonly string[]
  readonly artifactDeleteCandidates?: ReorganizeProposalV0['artifactDeleteCandidates']
  readonly hierarchyPatch?: ReorganizeProposalV0['hierarchyPatch']
  readonly relationPatch?: ReorganizeProposalV0['relationPatch']
  readonly emphasisPatch?: ReorganizeProposalV0['emphasisPatch']
  readonly layoutIntent?: ReorganizeProposalV0['layoutIntent']
}

/**
 * Phase D：Agent Reorganize。
 * proposal 持久化（重启可恢复）；apply 前可 preview；destructive 删除必须显式确认；
 * rollback 恢复 presentation 快照（已删 artifact 不可恢复 —— 应用前预览已确认）。
 */
export class ReorganizeService {
  readonly #metadata: SqliteMetadataRepository
  readonly #presentation: PresentationApplicationService

  constructor(metadata: SqliteMetadataRepository, presentation: PresentationApplicationService) {
    this.#metadata = metadata
    this.#presentation = presentation
  }

  create(input: CreateReorganizeProposalInputV0): ReorganizeProposalV0 {
    const presentation = this.#presentation.get(input.projectId, input.presentationId)
    if (presentation === undefined) throw new Error('Presentation not found.')
    const now = new Date().toISOString()
    const proposal: ReorganizeProposalV0 = {
      schemaVersion: 0,
      id: `reorg-${randomUUID()}`,
      projectId: input.projectId,
      presentationId: input.presentationId,
      baseVersion: input.baseVersion,
      status: 'pending',
      mergeCandidates: input.mergeCandidates ?? [],
      removeMemberViewIds: input.removeMemberViewIds ?? [],
      artifactDeleteCandidates: input.artifactDeleteCandidates ?? [],
      ...(input.hierarchyPatch === undefined ? {} : { hierarchyPatch: input.hierarchyPatch }),
      ...(input.relationPatch === undefined ? {} : { relationPatch: input.relationPatch }),
      ...(input.emphasisPatch === undefined ? {} : { emphasisPatch: input.emphasisPatch }),
      ...(input.layoutIntent === undefined ? {} : { layoutIntent: input.layoutIntent }),
      createdAt: now,
    }
    this.#metadata.createReorganizeProposal(proposal, JSON.stringify(presentation))
    return proposal
  }

  get(id: string): ReorganizeProposalV0 | undefined {
    return this.#metadata.getReorganizeProposal(id)?.proposal
  }

  list(projectId: string): ReorganizeProposalV0[] {
    return this.#metadata.listReorganizeProposals(projectId)
  }

  preview(id: string): ReorganizePreviewV0 {
    const stored = this.#metadata.getReorganizeProposal(id)
    if (stored === undefined) throw new Error('Proposal not found.')
    const proposal = stored.proposal
    const destructive = proposal.artifactDeleteCandidates.length > 0
    return {
      proposalId: proposal.id,
      willRemovePresentationMembers: proposal.removeMemberViewIds,
      willDeleteArtifacts: proposal.artifactDeleteCandidates.map((candidate) => candidate.artifactId),
      willMerge: proposal.mergeCandidates,
      hierarchyChanges: proposal.hierarchyPatch === undefined ? 0 : Object.keys(proposal.hierarchyPatch.parentByViewId).length,
      relationAdds: proposal.relationPatch?.add?.length ?? 0,
      relationRemoves: proposal.relationPatch?.remove?.length ?? 0,
      emphasisChanges: proposal.emphasisPatch === undefined ? 0 : Object.keys(proposal.emphasisPatch).length,
      destructive,
    }
  }

  apply(id: string, options: { readonly confirmDestructive?: boolean } = {}): ReorganizePreviewV0 {
    const stored = this.#metadata.getReorganizeProposal(id)
    if (stored === undefined) throw new Error('Proposal not found.')
    const proposal = stored.proposal
    if (proposal.status === 'applied') return this.preview(id)
    if (proposal.status === 'rolled_back' || proposal.status === 'rejected') throw new Error(`Proposal is ${proposal.status}.`)

    const previewResult = this.preview(id)
    if (previewResult.destructive && options.confirmDestructive !== true) {
      throw new Error('Destructive proposal requires confirmDestructive=true (destructive deletes artifacts).')
    }

    // 1. merge：移除被合并的源 view（汇总节点由 Agent 在提交前创建）
    const removeMemberIds = [...proposal.removeMemberViewIds]
    for (const merge of proposal.mergeCandidates) {
      removeMemberIds.push(...merge.sourceViewIds)
    }

    // 2. presentation patch（members/hierarchy/emphasis）
    const presentation = this.#presentation.get(proposal.projectId, proposal.presentationId)
    if (presentation === undefined) throw new Error('Presentation not found.')
    const currentVersion = presentation.version
    const state = structuredClone(presentation.state)
    const memberSet = new Set(state.memberViewIds)
    for (const viewId of removeMemberIds) memberSet.delete(viewId)
    state.memberViewIds = [...memberSet]
    if (proposal.hierarchyPatch !== undefined) {
      state.hierarchy = state.hierarchy ?? { parentByViewId: {}, orderByParent: {} }
      for (const [viewId, parentId] of Object.entries(proposal.hierarchyPatch.parentByViewId)) {
        state.hierarchy.parentByViewId[viewId] = parentId
      }
      for (const [parentId, order] of Object.entries(proposal.hierarchyPatch.orderByParent)) {
        state.hierarchy.orderByParent[parentId] = [...order]
      }
    }
    if (proposal.emphasisPatch !== undefined) {
      state.emphasisByViewId = { ...state.emphasisByViewId, ...proposal.emphasisPatch }
    }
    this.#presentation.save(proposal.projectId, {
      presentationId: proposal.presentationId,
      scopeId: presentation.scopeId,
      expectedVersion: currentVersion,
      renderer: presentation.renderer,
      capability: presentation.capability,
      state,
      updatedBy: 'agent',
    })

    // 3. relations
    for (const relation of proposal.relationPatch?.add ?? []) {
      const fromId = relation.from.entityId
      const toId = relation.to.entityId
      if (fromId === undefined || toId === undefined) continue
      this.#metadata.upsertRelation({
        id: `relation-${randomUUID()}` as never,
        projectId: proposal.projectId as never,
        sourceEntityType: (relation.from.entityType ?? 'artifact') as never,
        sourceEntityId: fromId,
        targetEntityType: (relation.to.entityType ?? 'artifact') as never,
        targetEntityId: toId,
        kind: relation.kind ?? 'informs',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(relation.origin === undefined ? {} : { origin: relation.origin as never }),
        ...(relation.createdBy === undefined ? {} : { createdBy: relation.createdBy }),
      })
    }
    for (const relationId of proposal.relationPatch?.remove ?? []) {
      this.#metadata.deleteRelation(relationId)
    }

    // 4. destructive artifact deletes（已确认）
    for (const candidate of proposal.artifactDeleteCandidates) {
      this.#metadata.deleteArtifact(candidate.artifactId)
    }

    this.#metadata.updateReorganizeProposalStatus(proposal.id, 'applied')
    return previewResult
  }

  rollback(id: string): ReorganizeProposalV0 {
    const stored = this.#metadata.getReorganizeProposal(id)
    if (stored === undefined) throw new Error('Proposal not found.')
    if (stored.proposal.status !== 'applied') throw new Error('Only applied proposals can be rolled back.')
    if (stored.snapshotJson === undefined) throw new Error('Proposal has no snapshot.')
    const snapshot = JSON.parse(stored.snapshotJson) as PresentationViewV0
    const current = this.#presentation.get(snapshot.projectId, snapshot.id)
    this.#presentation.save(snapshot.projectId, {
      presentationId: snapshot.id,
      scopeId: snapshot.scopeId,
      expectedVersion: current?.version ?? snapshot.version,
      renderer: snapshot.renderer,
      capability: snapshot.capability,
      state: snapshot.state,
      updatedBy: 'agent',
    })
    this.#metadata.updateReorganizeProposalStatus(id, 'rolled_back')
    return this.get(id)!
  }

  reject(id: string): ReorganizeProposalV0 {
    this.#metadata.updateReorganizeProposalStatus(id, 'rejected')
    return this.get(id)!
  }
}
