import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.6 centered run confirmation and Canvas lock', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const dialog = readFileSync(new URL('../src/features/create/RunConfirmDialog.tsx', import.meta.url), 'utf8')
  const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
  const createDialog = readFileSync(new URL('../src/features/create/CreateContentDialog.tsx', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')

  it('opens one centered confirmation instead of starting immediately', () => {
    expect(app).toContain('setRunConfirmOpen(true)')
    expect(app).toContain('<RunConfirmDialog')
    expect(app).toContain('onConfirm={confirmRun}')
    expect(dialog).toContain('把这次修改交给 Codex')
    expect(dialog).toContain('你想怎么修改')
    expect(dialog).toContain('修改目标')
    expect(dialog).toContain('参考内容')
  })

  it('allows ambiguous target selection inside the lightweight confirmation', () => {
    expect(rail).toContain('hasResolvableTarget')
    expect(dialog).toContain('这次主要修改哪个文件？')
    expect(dialog).toContain('onSelectTarget(node.id)')
  })

  it('keeps backdrop gestures inside the lock instead of dismissing the dialog', () => {
    expect(dialog).not.toContain('if (event.target === event.currentTarget) onCancel()')
    expect(dialog).toContain('event.currentTarget.setPointerCapture(event.pointerId)')
    expect(dialog).toContain('event.currentTarget.releasePointerCapture(event.pointerId)')
    expect(canvas).toContain("if (locked) { event.preventDefault(); event.stopPropagation(); return }")
    expect(canvas).toContain('if (locked) {\n      event.preventDefault()')
    expect(css).toContain('.app-shell.v06 .canvas.is-locked {\n  pointer-events: none;')
    expect(createDialog).not.toContain('if (event.target === event.currentTarget) onCancel()')
    expect(createDialog).toContain('event.currentTarget.setPointerCapture(event.pointerId)')
  })

  it('locks the Canvas and cancels queued gesture frames while the dialog is open', () => {
    expect(app).toContain('locked={createDialogOpen || runConfirmOpen || scopeCreateOpen}')
    expect(canvas).toContain('cancelAnimationFrame(dragFrame.current)')
    expect(canvas).toContain('cancelAnimationFrame(wheelFrame.current)')
    expect(canvas).toContain('wheelZoom.current = null')
    expect(css).toContain('.run-confirm-layer')
    expect(css).toContain('grid-column: 2')
    expect(css).toContain('animation-play-state: paused')
    expect(css).not.toContain('.run-confirm-layer {\n  backdrop-filter')
  })

  it('memoizes the heavy Canvas so editing the command does not rerender every node', () => {
    expect(canvas).toContain('memo(function ProjectCanvas')
    expect(app).toContain('const sceneStyle = useMemo')
    expect(app).toContain('onPointerWorldChange={rememberCanvasPoint}')
  })

  it('keeps advanced execution details collapsed by default', () => {
    expect(dialog).toContain('执行方式：Codex · 保存为新版本')
    expect(dialog).toContain('advancedOpen &&')
    expect(dialog).not.toContain('Context Pack')
    expect(dialog).not.toContain('Execution Router')
  })
})
