import { describe, expect, it } from 'vitest'
import { buildChangeTrace } from '../src/features/trace/changeTrace'
import type { ArtifactRevisionProvenance } from '../src/runtime/projectionAdapters'

describe('Phase 2 — Change Trace projection', () => {
  it('joins revision/provenance/run fields into deterministic entries without hidden reasoning', () => {
    const revisions: ArtifactRevisionProvenance[] = [
      { id: 'rev-2', label: 'V2 重写', createdAt: '2026-08-12T10:00:00.000Z', runId: 'run-9', prompt: '把开头改得更直接', provider: 'workbuddy', current: true, draft: false },
      { id: 'rev-1', label: 'V1 初稿', createdAt: '2026-08-11T09:00:00.000Z', current: false, draft: false },
    ]
    const trace = buildChangeTrace(revisions)
    expect(trace.map((entry) => entry.revisionId)).toEqual(['rev-1', 'rev-2'])
    expect(trace[1]).toMatchObject({
      actor: 'agent',
      action: 'V2 重写',
      reasonSummary: '把开头改得更直接',
      sourceRefs: ['workbuddy'],
      runId: 'run-9',
    })
    expect(trace[0]).toMatchObject({ actor: 'user', sourceRefs: [] })
    expect(JSON.stringify(trace)).not.toContain('thought')
  })
})
