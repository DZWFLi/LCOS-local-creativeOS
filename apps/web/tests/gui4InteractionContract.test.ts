import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const rail = readFileSync(new URL('../src/features/shell/WorkspaceRailVNext.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/features/shell/CanvasSceneHost.tsx', import.meta.url), 'utf8')
const surface = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')

describe('GUI-4 interaction contract', () => {
  it('Edge LOD：远视无选择只留 active/runtime 边；选择后非焦点边减弱', () => {
    expect(canvas).toContain("zoomBandForEdges === 'far'")
    expect(canvas).toContain("edge.active || edge.scope === 'runtime'")
    expect(canvas).toContain("dimmed={selectedIds.length > 0 && !focusEdgeIds.has(edge.id) && !edge.active}")
    expect(canvas).toContain("'dimmed'")
    expect(surface).toContain('.edge.dimmed')
  })

  it('跨空间组织采用 Drop Target = Intent，而不是先点「放入上下文」或打开 DropShelf', () => {
    expect(rail).toContain('data-project-view-drop-target={view.id}')
    expect(canvas).toContain('onDirectProjectViewDrop')
    expect(canvas).toContain('projectViewTargetAt')
    expect(canvas).toContain('加入 ${hit.target.label}')
    expect(app).toContain('directDropToProjectRailView')
    expect(canvas).not.toContain('aria-label="放入上下文"')
    expect(canvas).not.toContain('投送到其他空间')
    expect(shell).not.toContain('<DropShelf')
  })
})
