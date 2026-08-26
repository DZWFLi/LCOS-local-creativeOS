import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Gate F desktop interaction contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
  const appShell = readFileSync(new URL('../src/features/shell/AppShellView.tsx', import.meta.url), 'utf8')

  it('keeps one contextual composer without turning selection into an inspector route', () => {
    expect(app).toContain('<WorkRail')
    expect(app).not.toContain('<Inspector')
    expect(rail).toContain('work-rail-composer')
    expect(rail).toContain('告诉 Agent 你想对${props.contextLabel}做什么')
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

  it('uses Ctrl/Cmd or Shift as additive desktop selection modifiers', () => {
    expect(canvas).toContain('event.shiftKey || event.ctrlKey || event.metaKey')
    expect(canvas).toContain('additiveSelection(event)')
    expect(canvas).toContain('onCreateScopeFromSelection')
    expect(app).toContain('if (node.opensScopeId) {')
    expect(app).not.toContain('setFocusPreviewId(id)')
  })

  it('porcelain retired: shell mounts the reconstruction stack only (Tier-3c)', () => {
    // porcelain 退役（Tier-3c）：shell 只挂 reconstruction 栈，旧 porcelain 主题 shell class 锁定不再回归。
    expect(appShell).toContain('app-shell lcos-reconstructed')
    expect(appShell).not.toContain('porcelain-studio-v2')
  })
})
