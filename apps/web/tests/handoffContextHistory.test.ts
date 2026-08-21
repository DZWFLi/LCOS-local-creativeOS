import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { HandoffRecord } from '@local-creative-os/domain'
import { handoffToProjection } from '../src/features/surfaces/handoffProjection'

function record(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 'handoff-one',
    projectId: 'project-a' as HandoffRecord['projectId'],
    title: '本轮脚本分析完成',
    resumeMode: 'standard-handoff',
    fromProvider: 'codex',
    decisions: ['保留结构'],
    openQuestions: ['是否补对比素材'],
    nextActions: ['进入修订'],
    artifactRefs: [{ artifactId: 'artifact-script' as never }],
    messageRefs: [],
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z',
    ...overrides,
  }
}

describe('Handoff → Context History projection', () => {
  it('maps Core HandoffRecord to a user-readable projection with facts and date', () => {
    expect(handoffToProjection(record())).toEqual({
      id: 'handoff-one',
      from: 'codex',
      to: '项目',
      label: '本轮脚本分析完成',
      meta: '1 决定 · 1 未决 · 1 产物 · 2026/08/16',
    })
  })

  it('falls back to neutral labels and never shows empty shells', () => {
    expect(handoffToProjection(record({ fromProvider: undefined, decisions: [], openQuestions: [], artifactRefs: [] }))).toEqual({
      id: 'handoff-one',
      from: 'Agent',
      to: '项目',
      label: '本轮脚本分析完成',
      meta: '2026/08/16',
    })
  })
})

describe('Handoff Context History wiring (source contract)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/surfaces/ContextHistoryRail.tsx', import.meta.url), 'utf8')

  it('loads Core handoffs and projects them into Context History without a frontend copy', () => {
    expect(app).toContain('listHandoffs(activeProjectId')
    expect(app).toContain('handoffs: coreHandoffs.map(handoffToProjection)')
    expect(app).toContain('setCoreHandoffs([])')
  })

  it('feeds handoffs into Context Deposit Candidates', () => {
    expect(app).toContain('id: `handoff:${handoff.id}`')
    expect(app).toContain("source: 'Agent 交接'")
  })

  it('renders no empty shell when there are no handoffs', () => {
    expect(rail).toContain('if (!history.length && !handoffs.length) return null')
    expect(rail).toContain('handoffs.length > 0')
    expect(rail).toContain('handoff.meta')
  })
})
