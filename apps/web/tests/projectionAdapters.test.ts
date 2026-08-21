import { describe, expect, it } from 'vitest'
import {
  parseArtifactRevisions,
  parseProcessProjection,
  parseSessionSummaries,
  parseWorkspaceStates,
  summarizeRevisionCompare,
} from '../src/runtime/projectionAdapters'

describe('projectionAdapters contract coverage (Phase 2)', () => {
  it('maps artifact detail + revision list into provenances', () => {
    const detail = {
      artifact: { currentRevisionId: 'rev-2' },
      revisions: [
        { id: 'rev-1', label: 'V1', status: 'committed', createdAt: '2026-08-01T00:00:00.000Z', provenance: { run: { id: 'run-1', instruction: '初稿', provider: 'codex' } } },
        { id: 'rev-2', label: 'V2', status: 'current', createdAt: '2026-08-02T00:00:00.000Z', provenance: { run: { id: 'run-2', instruction: '修正', provider: 'workbuddy' } } },
      ],
    }
    const result = parseArtifactRevisions(detail, null)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'rev-2', label: 'V2', current: true, draft: false, runId: 'run-2', prompt: '修正', provider: 'workbuddy' })
    expect(result[1]).toMatchObject({ id: 'rev-1', label: 'V1', current: false, draft: false })
  })

  it('maps workspace states with optional counts', () => {
    const result = parseWorkspaceStates({
      states: [
        { id: 'ws-1', name: '收口前', createdAt: '2026-08-01T00:00:00.000Z', memberCount: 4, revisionCount: 9 },
        { id: 'ws-2', name: '收口后', createdAt: '2026-08-02T00:00:00.000Z' },
      ],
    })
    expect(result.map((item) => item.id)).toEqual(['ws-2', 'ws-1'])
    expect(result[1]).toMatchObject({ memberCount: 4, revisionCount: 9 })
  })

  it('maps process projection items and normalizes run status', () => {
    const result = parseProcessProjection({
      items: [
        {
          schemaVersion: 1,
          kind: 'run',
          id: 'p-1',
          runId: 'run-1',
          title: '需求分析',
          summary: '已收敛',
          status: 'awaiting_review',
          createdAt: '2026-08-01T00:00:00.000Z',
          provider: 'codex',
          contextViewIds: ['v-1'],
          targetViewIds: ['v-2'],
          outputViewIds: ['v-3'],
        },
        { schemaVersion: 1, kind: 'note', id: 'p-2', runId: 'run-2' },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'p-1', runId: 'run-1', status: 'review', contextViewIds: ['v-1'], targetViewIds: ['v-2'], outputViewIds: ['v-3'] })
  })

  it('maps session summaries and revision compare summaries', () => {
    const summaries = parseSessionSummaries({
      summaries: [
        { id: 's-1', title: '红区结论', summary: '已确定技术路线', runIds: ['run-1', 'run-2'], handoffRef: 'docs/handoffs/x.md', createdAt: '2026-08-01T00:00:00.000Z' },
      ],
    })
    expect(summaries[0]).toMatchObject({ id: 'session-summary-s-1', title: '红区结论', runIds: ['run-1', 'run-2'], handoffRef: 'docs/handoffs/x.md' })
    expect(summarizeRevisionCompare({ addedLines: 3, removedLines: 1 })).toBe('新增 3 · 删除 1')
    expect(summarizeRevisionCompare({ summary: '结构一致。' })).toBe('结构一致。')
  })
})
