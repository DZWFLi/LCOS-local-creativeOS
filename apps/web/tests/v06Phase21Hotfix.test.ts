import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.6 phase 2.1 task loop hotfix contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const dialog = readFileSync(new URL('../src/features/create/RunConfirmDialog.tsx', import.meta.url), 'utf8')

  it('routes composer Ctrl/Cmd+Enter through confirmation only', () => {
    expect(rail).toContain('event.stopPropagation()')
    expect(rail).toContain('event.nativeEvent.stopImmediatePropagation()')
    expect(rail).toContain('props.onSend()')
    expect(app).toContain('window.requestAnimationFrame(() =>')
    expect(app).toContain('setRunConfirmOpen(true)')
    expect(dialog).toContain('keyboardArmedRef.current')
    expect(dialog).toContain('!event.repeat')
  })

  it('uses a render-synchronized composer focus request for C and Continue Modify', () => {
    expect(app).toContain('const requestComposerFocus = useCallback')
    expect(app).toContain("if (key === 'c') { event.preventDefault(); requestComposerFocus(); return }")
    expect(app).toContain('requestComposerFocus()')
    expect(rail).toContain('composerFocusRequest')
    expect(rail).toContain('window.requestAnimationFrame')
    expect(rail).toContain('composer.focus({ preventScroll: true })')
  })

  it('compacts the exact completed process node in the same graph transaction as Accept', () => {
    expect(app).toContain("node.id === activeRun.processNodeId")
    expect(app).toContain("displayMode: 'compact'")
    expect(app).toContain("runStatus: 'completed'")
    expect(app).toContain('setGraph((current) => ({')
    expect(app).toContain('edges: current.edges.map')
  })
})
