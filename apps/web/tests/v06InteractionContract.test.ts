import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.6 intuitive interaction contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')

  it('has one adaptive Work Rail with a permanent contextual composer', () => {
    expect(app).toContain('<WorkRail')
    expect(app).not.toContain('<Inspector')
    expect(rail).toContain('work-rail-composer')
    expect(rail).toContain('告诉 AI 你想怎么改')
  })

  it('focuses the composer with C instead of creating a Command node', () => {
    expect(app).toContain("if (key === 'c')")
    expect(app).toContain('requestComposerFocus()')
    expect(rail).toContain('composer.focus({ preventScroll: true })')
    expect(app).not.toContain("createNodeAt('process'")
  })

  it('creates process records only after sending a command', () => {
    expect(app).toContain('startRunFrom')
    expect(app).toContain("kind: 'process'")
    expect(app).toContain('参考快照、指令和执行记录已自动保存')
  })

  it('uses single click for Work Rail following and double click for preview or child Canvas', () => {
    expect(canvas).toContain('onSelect(node.id, event.shiftKey)')
    expect(app).toContain('if (node.opensScopeId) enterScope(node.opensScopeId)')
    expect(app).toContain('setFocusPreviewId(id)')
  })

  it('reserves responsive Canvas space using the live Work Rail width', () => {
    expect(css).toContain('right: var(--work-rail-width) !important')
    expect(css).toContain('width: 100vw')
    expect(css).toContain('height: 100dvh')
  })
})
