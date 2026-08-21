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
    expect(rail).toContain('aria-label="主画布"')
    expect(rail).not.toContain('folder')
  })

  it('makes saved views draggable from the rail into the canvas', () => {
    expect(rail).toContain('draggable')
    expect(rail).toContain("setData('application/x-lcos-workspace'")
    expect(spatial).toContain("getData('application/x-lcos-workspace')")
    expect(canvas).toContain('onDirectProjectViewDrop')
  })

  it('routes a rail drop directly to the destination without duplicating artifacts (R3)', () => {
    const dropSite = canvas.slice(canvas.indexOf('onExternalDrop'), canvas.indexOf('overlays={spatialOverlays}'))
    expect(canvas).toContain('onDirectProjectViewDrop(hit.target.id, item.ids)')
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).toContain('projectViewTargetAt(event.clientX, event.clientY)')
  })
})
