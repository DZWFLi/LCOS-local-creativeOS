import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const spatial = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const visual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const projection = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const surfaces = [
  'apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx',
  'apps/web/src/features/surfaces/ContextFlowSurface.tsx',
  'apps/web/src/features/surfaces/ContextTreeSurface.tsx',
  'apps/web/src/features/surfaces/WorkflowGraphSurface.tsx',
  'apps/web/src/features/surfaces/WorkflowSurface.tsx',
].map(read)
const css = read('apps/web/src/product-interface.css')

const checks = [
  ['overview returns to root Scope', app.includes('setScopeId(rootScope.id)') && app.includes("setNotice('已回到主画布')")],
  ['active Workspace hides its own overview frame', app.includes('const visibleWorkspaceFrames = useMemo(() => workspaceId ? [] : workspaceFrames') && !app.includes('activeWorkspaceFrames')],
  ['Workspace membership has one canonical read projection', app.includes('workspaceMemberViewIdsById') && app.includes('workspaceMemberships') && app.includes('node.workspaceIds')],
  ['folded Collection hides member Views on parent canvas', app.includes('collapsedCollectionMemberIds') && app.includes('!collapsedCollectionMemberIds.has(node.id)')],
  ['Collection creation is direct, not old 3-choice dialog', app.includes("onCreateScopeFromSelection: () => selectedIds.length ? createScopeFromSelection({ label: '', kind: 'collection' })")],
  ['Collection click toggles in place and old no-op notice is gone', app.includes('toggleCollectionScope(targetScope.id)') && canvas.includes('onToggleCollection?.(collectionScopeId)') && !app.includes('Collection 是原地展开/收起的持久分组')],
  ['Collection stays an in-place Spatial stack instead of reopening a child canvas', app.includes('const toggleCollectionScope') && app.includes('openCollectionWithMotion(collectionScopeId)') && canvas.includes('collectionExpanded')],
  ['Workspace frame remains a spatial scene with explicit relation handles; the Main projection owns cross-surface Semantic Drop', canvas.includes('data-workspace-frame={frame.workspaceId}') && canvas.includes('workspace-relation-out') && canvas.includes('lcos-semantic-drop-handle')],
  ['Workflow import accepts Project Entity refs', app.includes('onImportProjectViewToWorkflow: (sourceIds)') && app.includes("appendExactPresentationEntityRefs('workflow', ownerId, semantic.entityRefs")],
  ['Context imports accept Project Entity refs', app.includes('addMembersToSavedContext') && app.includes("appendExactPresentationEntityRefs('context', contextId, semantic.entityRefs") && app.includes("appendExactPresentationEntityRefs('context', rootScope.id, semantic.entityRefs, 'context-graph'")],
  ['generic SpatialCanvas provides marquee and minimap', spatial.includes('marqueeItems?: readonly SpatialCanvasItem[]') && spatial.includes('lcos-spatial-marquee') && spatial.includes('SpatialMiniMap')],
  ['all five product Context/Workflow spatial surfaces wire marquee/minimap', surfaces.every((source) => source.includes('onMarqueeSelect={props.onMarqueeSelect}') && source.includes('minimapItems=')) && projection.includes('onMarqueeSelect:props.onMarqueeSelect')],
  ['hotfix visual affordances are styled', css.includes('.lcos-spatial-minimap') && css.includes('.lcos-spatial-marquee') && visual.includes('collectionExpanded')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} R3.1A4 static contracts passed`)
if (failed) process.exit(1)
