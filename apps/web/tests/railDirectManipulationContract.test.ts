import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rail = readFileSync(new URL('../src/features/shell/WorkspaceRailVNext.tsx', import.meta.url), 'utf8')
const curtain = readFileSync(new URL('../src/features/drop/LightCurtain.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/reconstruction.css', import.meta.url), 'utf8')

describe('Rail direct manipulation — reorder / drag-delete / rename / two-column / light curtains', () => {
  it('left-drag reorder commits to an atomic target index and persists through App wiring', () => {
    expect(rail).toContain('onReorderRailView?: (viewId: string, targetIndex: number) => void')
    expect(rail).toContain('beginLeftDrag')
    expect(rail).toContain('computeTargetIndex')
    expect(rail).toContain('lcos-rail-drag-float')
    expect(rail).toContain('shiftFor')
    expect(app).toContain('onReorderRailView: reorderRailViewTo')
    expect(app).toContain('saveViewRailOrder(activeProjectId, orderedRefs')
  })

  it('drag-to-delete arms a red gradient light curtain and reuses the existing delete confirm', () => {
    expect(rail).toContain("mode: 'delete'")
    expect(rail).toContain('onDeleteWorkspace?.(session.identity)')
    expect(rail).toContain('onDeleteScope?.(session.identity, session.title)')
    expect(rail).toContain('onDeleteScope?: (scopeId: string, label: string) => void')
    expect(rail).toContain('tone="delete"')
    expect(rail).toContain('松手删除')
    expect(curtain).toContain("tone: 'drop' | 'delete'")
    expect(css).toContain('tone-delete')
    expect(app).toContain('onDeleteScope: requestDeleteRailScope')
    expect(app).toContain('confirmScopeDelete')
  })

  it('restores the drop gradient light curtain on canvas and rail right-button drop', () => {
    expect(canvas).toContain('<LightCurtain tone="drop"')
    expect(canvas).toContain('setDropLight({ hot: Boolean(hit)')
    expect(rail).toContain('<LightCurtain tone="drop"')
    expect(css).toContain('.lcos-light-curtain-edge.anchor-left')
    expect(css).toContain('.lcos-light-curtain-edge.anchor-bottom')
  })

  it('supports inline rename inside the hover card for workspace-backed views', () => {
    expect(rail).toContain('onRenameWorkspace?: (workspaceId: string, label: string) => void')
    expect(rail).toContain('lcos-rail-rename-input')
    expect(rail).toContain('commitRename')
    expect(app).toContain('onRenameWorkspace: renameRailWorkspace')
  })

  it('adapts to two columns when the single-column capacity is exceeded', () => {
    expect(rail).toContain('twoColumn')
    expect(rail).toContain('columnOverride')
    expect(rail).toContain('lcos-rail-resize-handle')
    expect(rail).toContain('--lcos-rail-w')
    expect(css).toContain('.vnext-workspace-rail.is-two-column .lcos-project-view-stack')
  })

  it('keeps the hover preview card alive while moving toward it for inline rename', () => {
    expect(rail).toContain('schedulePreviewClose')
    expect(rail).toContain('keepPreviewOpen')
    expect(css).toContain('vnext-workspace-preview.lcos-workspace-preview::before')
  })
})
