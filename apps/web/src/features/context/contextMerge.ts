/**
 * Phase 3 §6.2：Relationship Home —— Context 视图合并提案。
 * 只计算成员差集，不写入任何持久化；Accept 才由调用方提交，Reject 零变更。
 */
export interface ContextViewSummary {
  readonly id: string
  readonly title: string
  /** Project View that represents this Context as a graph/workflow node. */
  readonly containerViewId?: string
  readonly memberViewIds: readonly string[]
  /** First-class aggregate Project entities participating in this Context. */
  readonly memberEntityNodeIds?: readonly string[]
  /** 与 memberViewIds 对齐的内容身份（artifactId ?? viewOf ?? viewId），用于跨视图去重。 */
  readonly memberContentKeys?: readonly string[]
}

export interface ContextMergeProposal {
  readonly type: 'context-membership-proposal'
  readonly targetContextId: string
  readonly sourceContextId: string
  readonly additions: readonly string[]
  readonly entityAdditions: readonly string[]
}

export function proposeContextMergeCandidate(
  source: ContextViewSummary,
  target: ContextViewSummary,
): ContextMergeProposal | null {
  if (source.id === target.id) return null
  const targetViewIds = new Set(target.memberViewIds)
  const targetContentKeys = new Set(target.memberContentKeys ?? target.memberViewIds)
  const sourceContentKeys = source.memberContentKeys ?? source.memberViewIds
  const additions = source.memberViewIds.filter((_id, index) => {
    const contentKey = sourceContentKeys[index] ?? source.memberViewIds[index]
    return !targetViewIds.has(source.memberViewIds[index]!) && !targetContentKeys.has(contentKey)
  })
  const targetEntityIds = new Set(target.memberEntityNodeIds ?? [])
  const entityAdditions = (source.memberEntityNodeIds ?? []).filter((id) => !targetEntityIds.has(id))
  return {
    type: 'context-membership-proposal',
    targetContextId: target.id,
    sourceContextId: source.id,
    additions,
    entityAdditions,
  }
}
