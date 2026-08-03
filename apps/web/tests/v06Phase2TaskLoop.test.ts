import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('vNext intuitive local-agent task loop contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const composer = readFileSync(new URL('../src/features/canvas/SelectionComposer.tsx', import.meta.url), 'utf8')

  it('uses an inline selection composer plus one global rail composer', () => {
    expect(composer).toContain('data-testid="selection-composer-input"')
    expect(rail).toContain('data-testid="work-rail-composer"')
    expect(app).toContain("if (key === 'c')")
    expect(app).toContain('requestComposerFocus()')
  })

  it('automatically changes the rail from execution to decision to review', () => {
    expect(rail).toContain("mode === 'waiting-input'")
    expect(rail).toContain("mode === 'review'")
    expect(rail).toContain("mode === 'run'")
    expect(app).toContain("status: 'review'")
    expect(app).toContain("status: 'completed'")
  })

  it('creates traceable process records only when the arrow sends', () => {
    expect(app).toContain('onSend: requestSelectionRun')
    expect(app).toContain('proposeRun(activeProjectId')
    expect(app).toContain("kind: 'process'")
    expect(app).toContain('contextSnapshotId')
  })

  it('returns results to Canvas and continues modification below that result', () => {
    expect(app).toContain('findPendingReturnPosition')
    expect(app).toContain('setSelectedIds([pendingNode.id])')
    expect(app).toContain('setSelectionComposerText(activeRun.command)')
    expect(rail).toContain('onContinueModify')
  })

  it('accepts returned drafts as current without exposing checkpoint UI', () => {
    expect(app).toContain("kind: 'working'")
    expect(app).toContain("reviewStatus: 'accepted'")
    expect(rail).toContain('保存当前工作现场')
    expect(app).not.toContain('创建检查点')
  })
})
