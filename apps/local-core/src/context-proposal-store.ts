import { randomUUID } from 'node:crypto'

import type { ContextChangeProposalV1 } from '@local-creative-os/contracts'

import type { ActiveContextStore, ActiveContextProjection } from './active-context-store.js'

export interface CreateContextProposalInput {
  readonly baseContextVersion: number
  readonly addViewIds: readonly string[]
  readonly removeViewIds: readonly string[]
  readonly targetViewId?: string
  readonly reason: string
}

/**
 * C4：Codex 上下文修改建议。建议不会直接改变 ActiveContext；
 * 用户 Accept 后 version +1；Reject/过期保留审计。
 * 当前为进程内存储（重启即清）；跨重启审计需 v14 表迁移（待批准）。
 */
export class ContextProposalStore {
  readonly #proposals = new Map<string, ContextChangeProposalV1[]>()

  constructor(private readonly activeContext: ActiveContextStore) {}

  create(
    projectId: string,
    input: CreateContextProposalInput,
    current: ActiveContextProjection,
  ): ContextChangeProposalV1 {
    if (input.baseContextVersion !== current.version) {
      throw new Error(`CONTEXT_STALE: base version ${input.baseContextVersion}, current ${current.version}.`)
    }
    const proposal: ContextChangeProposalV1 = {
      proposalId: `proposal-${randomUUID()}`,
      projectId,
      baseContextVersion: input.baseContextVersion,
      addViewIds: input.addViewIds,
      removeViewIds: input.removeViewIds,
      ...(input.targetViewId === undefined ? {} : { targetViewId: input.targetViewId }),
      reason: input.reason,
      createdBy: 'codex',
      status: 'pending',
    }
    const existing = this.#proposals.get(projectId) ?? []
    this.#proposals.set(projectId, [...existing, proposal])
    return proposal
  }

  get(projectId: string, proposalId: string): ContextChangeProposalV1 | undefined {
    return (this.#proposals.get(projectId) ?? []).find((proposal) => proposal.proposalId === proposalId)
  }

  list(projectId: string): readonly ContextChangeProposalV1[] {
    return this.#proposals.get(projectId) ?? []
  }

  accept(projectId: string, proposalId: string): ContextChangeProposalV1 {
    const proposal = this.get(projectId, proposalId)
    if (proposal === undefined) throw new Error('PROPOSAL_NOT_FOUND')
    if (proposal.status !== 'pending') throw new Error('PROPOSAL_NOT_PENDING')
    return this.#resolve(projectId, proposalId, 'accepted')
  }

  reject(projectId: string, proposalId: string): ContextChangeProposalV1 {
    const proposal = this.get(projectId, proposalId)
    if (proposal === undefined) throw new Error('PROPOSAL_NOT_FOUND')
    if (proposal.status !== 'pending') throw new Error('PROPOSAL_NOT_PENDING')
    return this.#resolve(projectId, proposalId, 'rejected')
  }

  #resolve(
    projectId: string,
    proposalId: string,
    status: 'accepted' | 'rejected' | 'stale',
  ): ContextChangeProposalV1 {
    const proposals = (this.#proposals.get(projectId) ?? []).map((proposal) =>
      proposal.proposalId === proposalId ? { ...proposal, status } : proposal)
    this.#proposals.set(projectId, proposals)
    const resolved = proposals.find((proposal) => proposal.proposalId === proposalId)
    if (resolved === undefined) throw new Error('PROPOSAL_NOT_FOUND')
    return resolved
  }

  markStale(projectId: string, proposalId: string): ContextChangeProposalV1 {
    return this.#resolve(projectId, proposalId, 'stale')
  }
}
