import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.6 phase 2 intuitive task loop contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')

  it('keeps one permanent composer and lets C focus it', () => {
    expect(rail).toContain('data-testid="work-rail-composer"')
    expect(app).toContain("if (key === 'c')")
    expect(app).toContain('requestComposerFocus()')
    expect(rail).toContain('composerFocusRequest')
    expect(app).not.toContain("createNodeAt('process'")
  })

  it('automatically changes the rail from execution to decision to review', () => {
    expect(rail).toContain("mode === 'waiting-input'")
    expect(rail).toContain("mode === 'review'")
    expect(rail).toContain("mode === 'run'")
    expect(app).toContain("status: 'review'")
    expect(app).toContain("status: 'completed'")
  })

  it('creates traceable process records only after final confirmation', () => {
    expect(app).toContain('setRunConfirmOpen(true)')
    expect(app).toContain('startRunFrom(composerText, inference.targetIds, inference.contextIds)')
    expect(app).toContain("kind: 'process'")
    expect(app).toContain('contextSnapshotId: createId')
  })

  it('returns results to the Canvas and lets continue modification target that result', () => {
    expect(app).toContain('findPendingReturnPosition')
    expect(app).toContain('setSelectedIds([id])')
    expect(app).toContain("setComposerText('继续修改：')")
    expect(rail).toContain('onContinueModify')
  })

  it('accepts the returned artifact as current and archives the process summary', () => {
    expect(app).toContain("kind: 'working'")
    expect(app).toContain("reviewStatus: 'accepted'")
    expect(app).toContain("activeRun.status === 'completed' ? 'compact' : 'standard'")
    expect(rail).toContain('已接受为当前版本')
  })
})
