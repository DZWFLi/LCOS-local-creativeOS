import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('v0.6 simplified content creation contract', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const dock = readFileSync(new URL('../src/features/workspace/WorkspaceDock.tsx', import.meta.url), 'utf8')
  const capabilityPopover = readFileSync(new URL('../src/features/shell/CapabilityPopover.tsx', import.meta.url), 'utf8')
  const dialog = readFileSync(new URL('../src/features/create/CreateContentDialog.tsx', import.meta.url), 'utf8')
  const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')

  it('keeps creation in the compact capability launcher without restoring a nested dock menu', () => {
    expect(dock).toContain('添加与工作流')
    expect(dock).toContain('onOpenCapabilities')
    expect(capabilityPopover).toContain('onCreateObject')
    expect(dock).not.toContain('dock-create-menu')
    expect(dock).not.toContain('createOpen')
  })

  it('shows only two human-readable creation outcomes', () => {
    expect(dialog).toContain('记录一个想法')
    expect(dialog).toContain('建立内容集合')
    expect(dialog).toContain('节点类型、关系和位置由系统处理')
    expect(dialog).not.toContain('Command')
    expect(dialog).not.toContain('Context Pack')
    expect(dialog).not.toContain('Skill')
  })

  it('centers the dialog outside the transformed canvas and locks canvas interaction', () => {
    expect(dialog).toContain('createPortal')
    expect(dialog).toContain('canvas-create-layer')
    expect(app).toContain('locked={createDialogOpen || runConfirmOpen || scopeCreateOpen}')
    expect(canvas).toContain("${locked ? 'is-locked' : ''}")
    expect(css).toContain('.canvas.is-locked')
    expect(css).toContain('pointer-events: none')
    expect(css).toContain('grid-column: 2')
    expect(css).not.toContain('.canvas-create-layer {\n  backdrop-filter')
  })

  it('uses Space plus blank-canvas click to create at the pointer instead of panning', () => {
    expect(canvas).toContain('blankCanvas && spaceHeld')
    expect(canvas).toContain('onSpaceCreate(point)')
    expect(app).toContain('onSpaceCreate={(point) =>')
  })
})
