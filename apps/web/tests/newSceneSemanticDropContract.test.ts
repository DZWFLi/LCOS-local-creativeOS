import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const rail = source('features/shell/WorkspaceRailVNext.tsx')
const drop = source('features/spatial/semanticDrop.ts')
const dialog = source('features/workspace/WorkspaceDialog.tsx')

describe('R3.1 B3R4 Selection semantic drop to New Scene contract', () => {
  const commit = app.slice(app.indexOf('const createWorkspaceSceneFromDropPayload'), app.indexOf('const directDropToProjectRailView'))
  const directDrop = app.slice(app.indexOf('const directDropToProjectRailView'), app.indexOf('const addSelectionToContext'))

  it('exposes one transient Rail-empty-area New Scene destination without replacing existing destinations', () => {
    expect(drop).toContain("NEW_SCENE_DROP_TARGET_ID = 'workspace:new-scene'")
    expect(rail).toContain('data-testid="new-scene-drop-target"')
    expect(rail).toContain('data-project-view-drop-target={NEW_SCENE_DROP_TARGET_ID}')
    expect(rail).toContain('data-project-view-drop-label="+ 新 Scene"')
    expect(rail).toContain('data-project-view-drop-target={view.id}')
  })

  it('commits only the frozen drag payload through stable normalization and dedupe', () => {
    expect(commit).toContain('semanticRefsForSourceIds(sourceIds, nodes)')
    expect(commit).toContain('buildWorkspaceScene(viewIds)')
    expect(commit).toContain('workspaceIds: [...new Set(')
    expect(commit).toContain("appendExactPresentationEntityRefs('custom', `workspace:${scene.id}`")
    expect(commit).not.toContain('selectedIds')
    expect(commit).not.toContain('currentSceneSemantic')
  })

  it('rejects empty/invalid payload and atomically activates Arrange on success', () => {
    expect(commit).toContain('if (!viewIds.length && !entityRefs.length) return false')
    expect(commit).toContain('setWorkspaceId(scene.id)')
    expect(commit).toContain("setActiveSurface('arrange')")
    expect(commit).toContain('clearSelection()')
    expect(directDrop).toContain('if (targetViewId === NEW_SCENE_DROP_TARGET_ID)')
    expect(directDrop).toContain('createWorkspaceSceneFromDropPayload(sourceIds)')
  })

  it('preserves Empty Scene plus, edit-only dialog, and migration-only temporary workbench', () => {
    expect(app).toContain('onAdd: createEmptyWorkspaceScene')
    expect(app).toContain('const scene = buildWorkspaceScene([])')
    expect(dialog).not.toContain('WorkspaceSeedMode')
    expect(dialog).not.toContain("mode: 'create' | 'edit'")
    expect(app).toContain('Legacy temporary-workbench remains readable for migration compatibility only')
  })

  it('cancels shared and Rail semantic drags on Escape without committing', () => {
    expect(drop).toContain("if (keyboardEvent.key !== 'Escape') return")
    expect(drop).toContain("window.addEventListener('keydown', cancelWithEscape, true)")
    expect(rail).toContain('semanticDrop.current = null')
    expect(rail).toContain('setDropGhost(null)')
  })
})
