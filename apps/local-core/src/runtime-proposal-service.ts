import type { CreateRunProposal, RunProposalResult } from '@local-creative-os/contracts'

/**
 * Phase 0 Proposal 服务（6.2）：把 selection + prompt 归纳成可见的一行摘要与
 * 默认 Proposal。当前为确定性规则实现；模型可用时替换判断源，但契约不变。
 * Proposal 不是执行记录：真正发送后才冻结 ContextManifest。
 */

const ANALYZE_HINTS = /分析|检查|评估|总结|梳理|节奏|问题|建议|对比/
const CREATE_HINTS = /创建|生成|新建|写一份|起草|设计|产出|做一份/
const REVISE_HINTS = /修改|改|优化|调整|润色|继续|扩写|精简|修复/

function inferIntent(prompt: string, editTargetCount: number): CreateRunProposal['intent'] {
  if (REVISE_HINTS.test(prompt)) return 'revise'
  if (CREATE_HINTS.test(prompt)) return 'create'
  if (ANALYZE_HINTS.test(prompt)) return 'analyze'
  return editTargetCount > 0 ? 'revise' : 'analyze'
}

function defaultResultPolicy(intent: CreateRunProposal['intent']): CreateRunProposal['resultPolicy'] {
  switch (intent) {
    case 'analyze': return { type: 'reply_only' }
    case 'create': return { type: 'create_artifact' }
    case 'revise': return { type: 'draft_revision_per_target' }
  }
}

function oneLineSummary(proposal: CreateRunProposal): string {
  const provider = proposal.requestedProvider === 'auto' ? 'Auto' : proposal.requestedProvider
  const contextCount = proposal.contextItems.length
  switch (proposal.intent) {
    case 'analyze':
      return `将参考 ${contextCount} 项，由 ${provider} 分析并${proposal.resultPolicy.type === 'reply_only' ? '直接回复' : '生成分析结果'}。`
    case 'create':
      return `将参考 ${contextCount} 项，由 ${provider} 新建${proposal.resultPolicy.type === 'create_collection' ? '一个内容集合' : '新内容'}。`
    case 'revise': {
      const target = proposal.editTargets[0]
      const targetLabel = target === undefined ? '（未指定目标）' : `「${target.artifactId} · ${target.baseRevisionId.slice(0, 8)}」`
      const targets = proposal.editTargets.length > 1 ? `等 ${proposal.editTargets.length} 个对象` : ''
      return `将参考 ${contextCount} 项，由 ${provider} 修改${targetLabel}${targets}，生成新 Draft Revision。`
    }
  }
}

export type ProposeRunInput =
  & Omit<CreateRunProposal, 'intent' | 'resultPolicy'>
  & {
    readonly intent?: CreateRunProposal['intent']
    readonly resultPolicy?: CreateRunProposal['resultPolicy']
  }

export function proposeRun(input: ProposeRunInput): RunProposalResult {
  const prompt = input.prompt.trim()
  if (prompt.length === 0) throw new Error('Run prompt is required.')
  const intent = input.intent ?? inferIntent(prompt, input.editTargets.length)

  // Domain Guard（6.3）：analyze 禁止写目标文件；create 只能新建。
  let editTargets = input.editTargets
  if (intent === 'analyze' && editTargets.length > 0) {
    throw new Error('analyze 不允许指定修改目标；请把对象放入参考（Context）。')
  }
  if (intent === 'create' && editTargets.length > 0) {
    throw new Error('create 只能创建新 Artifact；修改已有对象请选择 revise。')
  }

  let resultPolicy = input.resultPolicy
  if (intent === 'revise' && resultPolicy?.type !== 'draft_revision_per_target') {
    if (resultPolicy !== undefined) {
      throw new Error('revise 的结果去向只能是“每个目标生成新 Draft Revision”。')
    }
    resultPolicy = defaultResultPolicy('revise')
  }
  if (intent === 'analyze' && resultPolicy !== undefined && !['reply_only', 'create_artifact'].includes(resultPolicy.type)) {
    throw new Error('analyze 的结果去向只能是直接回复或创建分析 Artifact。')
  }
  if (intent === 'create' && resultPolicy !== undefined && !['create_artifact', 'create_collection'].includes(resultPolicy.type)) {
    throw new Error('create 的结果去向只能是新建 Artifact 或内容集合。')
  }
  resultPolicy ??= defaultResultPolicy(intent)

  const proposal: CreateRunProposal = {
    projectId: input.projectId,
    ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
    prompt,
    intent,
    requestedProvider: input.requestedProvider,
    contextItems: input.contextItems,
    editTargets,
    resultPolicy,
  }

  const summary = oneLineSummary(proposal)
  const ambiguity = intent === 'revise' && editTargets.length === 0
    ? { question: '你希望修改哪个对象？请选择一个目标，或把这些对象全部作为参考。' }
    : undefined
  return {
    proposal,
    summary,
    confidence: ambiguity === undefined ? 'high' : 'low',
    ...(ambiguity === undefined ? {} : { ambiguity }),
  }
}
