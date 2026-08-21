import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = read('apps/web/src/App.tsx')
const rail = read('apps/web/src/features/shell/WorkspaceRailVNext.tsx')
const drop = read('apps/web/src/features/spatial/semanticRightDrop.ts')
const dialog = read('apps/web/src/features/workspace/WorkspaceDialog.tsx')
const commit = app.slice(app.indexOf('const createWorkspaceSceneFromDropPayload'), app.indexOf('const directDropToProjectRailView'))
const checks = [
  ['Workspace + still creates Empty Scene with 0 members', app.includes('onAdd: createEmptyWorkspaceScene') && app.includes('const scene = buildWorkspaceScene([])')],
  ['Rail empty area exposes New Scene target', rail.includes('data-testid="new-scene-drop-target"') && rail.includes('data-project-view-drop-target={NEW_SCENE_DROP_TARGET_ID}')],
  ['membership comes only from frozen drag payload', commit.includes('semanticRefsForSourceIds(sourceIds, nodes)') && !commit.includes('selectedIds')],
  ['stable EntityRefs are normalized and persisted', commit.includes('normalized.entityRefs.filter') && commit.includes('appendExactPresentationEntityRefs')],
  ['dedupe preserves stable Scene membership', commit.includes('buildWorkspaceScene(viewIds)') && app.includes('focusedViewIds: [...new Set(focusedViewIds)]')],
  ['invalid or empty payload cannot create Scene', commit.includes('if (!viewIds.length && !entityRefs.length) return false')],
  ['new Scene activates immediately in Arrange', commit.includes('setWorkspaceId(scene.id)') && commit.includes("setActiveSurface('arrange')")],
  ['existing Workspace drop destination remains', rail.includes('data-project-view-drop-target={view.id}') && app.includes('if (target.workspaceId)')],
  ['WorkspaceDialog remains edit-only', !dialog.includes('WorkspaceSeedMode') && !dialog.includes("mode: 'create' | 'edit'")],
  ['temporary-workbench remains migration-read-only', app.includes('Legacy temporary-workbench remains readable for migration compatibility only')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} B3R4 contracts passed`)
if (failed) process.exit(1)
