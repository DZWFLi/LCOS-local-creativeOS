import { describe, expect, it } from 'vitest'

import { proposeRun, type ProposeRunInput } from '../src/runtime-proposal-service.js'

function base(overrides: Partial<ProposeRunInput> = {}): ProposeRunInput {
  return {
    projectId: 'project-proposal',
    prompt: '分析这些参考材料的节奏问题',
    requestedProvider: 'auto',
    contextItems: [{ artifactId: 'a1', revisionId: 'r1', order: 1 }],
    editTargets: [],
    resultPolicy: { type: 'reply_only' },
    ...overrides,
  }
}

describe('Runtime Proposal Service (Phase 0)', () => {
  it('infers analyze intent and keeps reply_only result policy', () => {
    const result = proposeRun(base())
    expect(result.proposal.intent).toBe('analyze')
    expect(result.proposal.resultPolicy).toEqual({ type: 'reply_only' })
    expect(result.confidence).toBe('high')
    expect(result.summary).toContain('分析')
  })

  it('infers create intent and defaults to create_artifact', () => {
    const result = proposeRun(base({ prompt: '根据这些参考创建一份新脚本', resultPolicy: { type: 'create_artifact' } }))
    expect(result.proposal.intent).toBe('create')
    expect(result.proposal.resultPolicy).toEqual({ type: 'create_artifact' })
  })

  it('infers revise from explicit edit targets and emits a visible one-line summary', () => {
    const result = proposeRun(base({
      prompt: '把开场压缩到三秒',
      editTargets: [{ artifactId: 'script', baseRevisionId: 'rev-current' }],
      resultPolicy: { type: 'draft_revision_per_target' },
    }))
    expect(result.proposal.intent).toBe('revise')
    expect(result.summary).toContain('script')
    expect(result.summary).toContain('Draft Revision')
  })

  it('asks a minimal question when revise has no target', () => {
    const result = proposeRun(base({ prompt: '帮我改一下这个', resultPolicy: { type: 'draft_revision_per_target' } }))
    expect(result.confidence).toBe('low')
    expect(result.ambiguity?.question).toContain('修改哪个对象')
  })

  it('rejects analyze with edit targets and create with edit targets', () => {
    expect(() => proposeRun(base({ editTargets: [{ artifactId: 'a', baseRevisionId: 'r' }] })))
      .toThrow(/analyze 不允许/)
    expect(() => proposeRun(base({
      prompt: '创建新文件',
      editTargets: [{ artifactId: 'a', baseRevisionId: 'r' }],
      resultPolicy: { type: 'create_artifact' },
    }))).toThrow(/create 只能创建新 Artifact/)
  })

  it('rejects result policies that violate the intent guard', () => {
    expect(() => proposeRun(base({ prompt: '修改一下', resultPolicy: { type: 'reply_only' } })))
      .toThrow(/revise 的结果去向/)
    expect(() => proposeRun(base({ resultPolicy: { type: 'create_collection' } })))
      .toThrow(/analyze 的结果去向/)
  })
})
