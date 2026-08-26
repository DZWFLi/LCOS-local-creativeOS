import fs from 'node:fs'
const checks = [
 ['Scene parent frame removed', ['apps/web/src/App.tsx', 'const visibleWorkspaceFrames = useMemo(() => [], [])']],
 ['Scene members collapse behind entity on Main', ['apps/web/src/App.tsx', '!mainSceneMemberIds.has(node.id)']],
 ['Workspace projection materialized', ['apps/web/src/App.tsx', 'mainWorkspaceProjectionNodes']],
 ['Scene folder drop leaves entity on Main', ['apps/web/src/App.tsx', '双击 Scene 实体进入']],
 ['F2 renames normal nodes', ['apps/web/src/App.tsx', "event.key === 'F2' && selectedIds.length === 1"]],
 ['Selection rename not scope-only', ['apps/web/src/App.tsx', 'selectedIds.length === 1 && selectedNodes.length === 1']],
 ['Culling starts before 150', ['apps/web/src/features/spatial/spatialLod.ts', 'items.length < 48']],
 ['Drag preview local', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'dragPreviewPositions']],
 ['Drag commit once', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'setDragPreviewPositions(preview)']],
 ['Overview LOD uses cheap proxy', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'lcos-overview-node-proxy']],
 ['Workspace projection can move', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'onWorkspaceProjectionMove']],
 ['Managed Text uses document family', ['apps/web/src/features/canvas/CanvasNodeVisual.tsx', "node.managed && node.artifactId ? 'document' : 'note'"]],
 ['Previous round visualBounds retained', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'getVisualSelectionBounds']],
 ['Previous round grid snap retained', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'snapNodePositionToGrid']],
 ['Previous round collection balanced layout retained', ['apps/web/src/features/canvas/collectionExpandLayout.ts', 'members.length > 9']],
]
let pass=0
for (const [label,[file,needle]] of checks) { const text=fs.readFileSync(file,'utf8'); const ok=text.includes(needle); console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok) pass++ }
console.log(`Main Canvas Human QA Round 1 static: ${pass}/${checks.length}`)
if(pass!==checks.length) process.exit(1)
