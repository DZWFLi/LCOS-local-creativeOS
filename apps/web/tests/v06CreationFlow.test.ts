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

  it('shows exactly three human-readable creation outcomes (F6: Text / Collection / Blank Result)', () => {
    // F6 truth：三种明确起点——可读文本、内容集合、空白结果（ResultSlot）；不再只有两种。
    expect(dialog).toContain('这里只建立三种明确的起点')
    expect(dialog).toContain('新建文本')
    expect(dialog).toContain('建立内容集合')
    expect(dialog).toContain('空白结果')
    expect(dialog).toContain('先留一个结果位；最终形态由这次 Conversation Return 决定')
    expect(dialog).not.toContain('Command')
    expect(dialog).not.toContain('Context Pack')
    expect(dialog).not.toContain('Skill')
    expect(dialog).not.toContain('最基础的文本或集合')
  })

  it('Blank Result is a Core-authoritative ResultSlot, never a fake Artifact', () => {
    // 空白结果走 Core createResultSlot（authoritative ResultSlot 生命周期），不伪造 Artifact 形态。
    expect(dialog).toContain("onCreate('result-slot')")
    expect(app).toContain("kind: 'note' | 'context' | 'result-slot'")
    expect(app).toContain('createBlankResultSlotAt(x, y)')
    expect(app).toContain('client.createResultSlot(activeProjectId, {')
    // materialized 后回到 canonical Artifact morphology（ResultSlot 投影层存在，前端不手搓假 Artifact 节点）。
    expect(app).toContain('resultSlotProjection')
  })

  it('centers the dialog outside the transformed canvas and locks canvas interaction', () => {
    expect(dialog).toContain('createPortal')
    expect(dialog).toContain('canvas-create-layer')
    expect(app).toContain('locked: createDialogOpen || scopeCreateOpen')
    expect(canvas).toContain("${locked ? 'is-locked' : ''}")
    expect(css).toContain('.canvas.is-locked')
    expect(css).toContain('pointer-events: none')
    expect(css).toContain('grid-column: 2')
    expect(css).not.toContain('.canvas-create-layer {\n  backdrop-filter')
  })

  it('uses Space plus blank-canvas click to create at the pointer instead of panning', () => {
    expect(canvas).toContain('blankCanvas && spaceHeld')
    expect(canvas).toContain('onSpaceCreate(point)')
    expect(app).toContain('onSpaceCreate: (point) =>')
  })
})
