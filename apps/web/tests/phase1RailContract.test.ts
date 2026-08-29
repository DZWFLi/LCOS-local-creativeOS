import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const strip = readFileSync(new URL('../src/features/shell/ProjectStripVNext.tsx', import.meta.url), 'utf8')
const rail = readFileSync(new URL('../src/features/shell/WorkspaceRailVNext.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const spatial = readFileSync(new URL('../src/features/spatial/SpatialCanvas.tsx', import.meta.url), 'utf8')
const nodeVisual = readFileSync(new URL('../src/features/canvas/CanvasNodeVisual.tsx', import.meta.url), 'utf8')

describe('Phase 1 — Shell / Left Rail cleanup contract', () => {
  it('retires the main-canvas capture receiver pill from the project strip', () => {
    expect(strip).not.toContain('captureTarget')
    expect(strip).not.toContain('vnext-capture-target')
    expect(strip).not.toContain('收件')
  })

  it('replaces the node question-mark affordance with a neutral info control', () => {
    expect(nodeVisual).not.toContain('CircleHelp')
    expect(nodeVisual).toContain('Info size={12}')
  })

  it('keeps the Left Rail flat with a fixed Main entry first', () => {
    expect(rail).toContain('data-rail-kind="main"')
    expect(rail).toContain("aria-label={mainMarkerCount ? `主画布，${mainMarkerCount} 个导航重点` : '主画布'}") // R2C：主画布入口带导航重点计数
    // F6 truth：rail 仍是 flat 单列视图栈（main 固定首项 + views 列表），无文件夹树导航层级。
    // 「folder」允许作为 collection 成员预览的 CSS 词汇（lcos-rail-folder-members，真 mini 布局），
    // 禁止的是旧 folder 树/嵌套导航心智的复活。
    expect(rail).not.toContain('folder-tree')
    expect(rail).not.toContain('folderNode')
    expect(rail).not.toContain('文件夹导航')
  })

  it('makes saved views draggable from the rail into the canvas', () => {
    expect(rail).toContain('draggable')
    expect(rail).toContain("setData('application/x-lcos-workspace'")
    expect(spatial).toContain("getData('application/x-lcos-workspace')")
    expect(canvas).toContain('onDirectProjectViewDrop')
  })

  it('routes a rail drop directly to the destination without duplicating artifacts (R3)', () => {
    const dropSite = canvas.slice(canvas.indexOf('onExternalDrop'), canvas.indexOf('overlays={spatialOverlays}'))
    expect(canvas).toContain('commitProjectViewTarget(hit.target.id, item.ids)') // R2D：统一提交分发器
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).toContain('projectViewTargetAt(event.clientX, event.clientY)')
  })
})
