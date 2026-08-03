import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.7.1 corrected interaction contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/v071.css', import.meta.url), 'utf8')

  it('keeps a contextual composer without turning selection into an inspector route', () => {
    expect(app).toContain('<WorkRail')
    expect(app).not.toContain('<Inspector')
    expect(rail).toContain('work-rail-composer')
    expect(rail).toContain('告诉 AI 你想怎么改')
    expect(app).not.toContain('focusNode=')
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

  it('uses single click for selection, a local toolbar for quick actions, and explicit Scope entry', () => {
    expect(canvas).toContain('onSelect(node.id, event.shiftKey)')
    expect(canvas).toContain('<NodeContextToolbar')
    expect(app).toContain('if (node.opensScopeId) {')
    expect(app).not.toContain('setFocusPreviewId(id)')
  })

  it('overlays the adaptive Work Rail without resizing the Canvas', () => {
    expect(css).toContain('.app-shell.v071 .canvas { right: 0 !important; transition: none !important; }')
    expect(css).toContain('transform: translateX(0)')
    expect(css).not.toContain('transition: right')
  })
})
