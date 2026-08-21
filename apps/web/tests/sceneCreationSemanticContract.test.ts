import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const dialog = source('features/workspace/WorkspaceDialog.tsx')

describe('R3.1 B3R3 Scene creation semantic contract', () => {
  const factoryBlock = app.slice(app.indexOf('const buildWorkspaceScene'), app.indexOf('const openCurrentScene'))
  const createBlock = app.slice(app.indexOf('const createEmptyWorkspaceScene'), app.indexOf('const openCurrentScene'))

  it('creates an empty Arrange Scene entity on Main without teleporting into it', () => {
    expect(app).toContain('onAdd: createEmptyWorkspaceScene')
    expect(createBlock).toContain('buildWorkspaceScene([])')
    expect(factoryBlock).toContain("preferredSurface: 'arrange'")
    expect(createBlock).toContain('setWorkspaceId(null)')
    expect(createBlock).not.toContain('setWorkspaceId(scene.id)')
    expect(createBlock).not.toContain('setCamera(scene.camera)')
    expect(createBlock).toContain("setActiveSurface('arrange')")
    expect(createBlock).toContain('clearSelection()')
    expect(app).toContain('双击 Scene 实体进入')
  })

  it('keeps Selection separate from Scene membership', () => {
    expect(createBlock).not.toContain('selectedIds')
    expect(createBlock).not.toContain('semanticRefsForSourceIds')
    expect(createBlock).not.toContain('currentSceneSemantic')
    expect(createBlock).toContain('clearSelection()')
  })

  it('removes create mode and seed choices from WorkspaceDialog', () => {
    expect(dialog).not.toContain('WorkspaceSeedMode')
    expect(dialog).not.toContain("mode: 'create' | 'edit'")
    expect(dialog).not.toContain('seedMode')
    expect(dialog).not.toContain('当前 Selection')
    expect(dialog).not.toContain('当前画布现场')
    expect(dialog).not.toContain('空白现场')
    expect(dialog).toContain('重命名工作空间')
  })

  it('branches Context History through Core and keeps only migration-only temporary workbench', () => {
    expect(app).toContain('New Context-history branching calls Core branchContextSnapshot')
    expect(app).toContain('branchContextSnapshot(activeProjectId, String(snapshot.id)')
    expect(app).not.toContain("const scene: Workspace = { ...workspace, preferredSurface: 'arrange', contextPolicy: 'workspace-related' }")
    expect(app).toContain('Legacy temporary-workbench remains readable for migration compatibility only')
  })
})
