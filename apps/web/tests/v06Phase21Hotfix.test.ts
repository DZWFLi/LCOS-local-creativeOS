import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('vNext direct task loop hotfix contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const composer = readFileSync(new URL('../src/features/canvas/SelectionComposer.tsx', import.meta.url), 'utf8')

  it('routes Ctrl/Cmd+Enter to selection or global context without a confirmation page', () => {
    expect(app).toContain('selectedIds.length ? requestSelectionRun() : requestGlobalRun()')
    expect(composer).toContain("event.key === 'Enter'")
    expect(composer).toContain('props.onSend()')
    expect(rail).toContain('event.nativeEvent.stopImmediatePropagation()')
    expect(app).not.toContain('setRunConfirmOpen(true)')
  })

  it('focuses the inline selection composer first and the global rail otherwise', () => {
    expect(app).toContain("document.querySelector<HTMLTextAreaElement>('[data-testid=\"selection-composer-input\"]')")
    expect(app).toContain("document.querySelector<HTMLTextAreaElement>('[data-testid=\"work-rail-composer-input\"]')")
    expect(app).toContain("if (key === 'c') { event.preventDefault(); if (layoutMode === 'sidecar')")
    expect(app).toContain('侧边协作模式不提供 LCOS 输入框')
    expect(app).toContain('requestComposerFocus(); return')
    expect(rail).toContain('composerFocusRequest')
  })

  it('compacts the exact completed process node in the same graph transaction as Accept', () => {
    expect(app).toContain('node.id === activeRun.processNodeId')
    expect(app).toContain("displayMode: 'compact'")
    expect(app).toContain("runStatus: 'completed'")
    expect(app).toContain('setGraph((current) => ({')
    expect(app).toContain('edges: current.edges.map')
  })
})
