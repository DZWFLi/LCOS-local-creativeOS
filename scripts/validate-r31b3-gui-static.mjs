import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const contextGraph = read('apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx')
const contextSpace = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const evolution = read('apps/web/src/features/surfaces/ContextFlowSurface.tsx')
const structure = read('apps/web/src/features/surfaces/ContextTreeSurface.tsx')
const projection = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const workflowGraph = read('apps/web/src/features/surfaces/WorkflowGraphSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const material = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const signals = read('apps/web/src/features/design/DotGlyph.tsx')
const dock = read('apps/web/src/features/shell/SurfaceDock.tsx')
const presentations = read('packages/contracts/src/presentations.ts')

check('Main is permanently freeform; deterministic geometry is an explicit action, not a mode', canvas.includes('layout-mode-freeform') && canvas.includes('对齐与分布') && !canvas.includes('lcos-spatial-mode-switch'))
check('Top-level shell exposes Main / Context / Workflow, not Arrange as a product mode', dock.includes("label:'主画布'") && dock.includes("label:'上下文'") && dock.includes("label:'工作流'") && !dock.includes("label:'整理'"))
check('Context Graph remains project-level overview', contextGraph.includes('Context Graph') && contextGraph.includes('<SpatialCanvas'))
check('Concrete Context defaults to Understanding Space', projection.includes("props.surface==='context-space'?<ContextSpaceSurface") && contextSpace.includes('理解现场'))
check('Structure and Evolution remain lenses over the same Context truth', projection.includes("props.surface==='context-flow'") && projection.includes("props.surface==='context-tree'") && evolution.includes('trackSegments') && structure.includes('共用同一份 Context'))
check('Context does not require choosing Structure/Evolution before work', dock.includes("if(next === 'context') onSurface('context-graph')") && contextSpace.includes('onImportProjectView'))
check('Workflow keeps level-1 overview + level-2 action scene', workflowGraph.includes('project action network') && projection.includes('!props.activeWorkflowId?<WorkflowGraphSurface') && projection.includes('<WorkflowSurface'))
check('Workflow action skeleton is distinct from Project materials', presentations.includes('WorkflowActionV0') && workflow.includes('data-workflow-action-input={action.id}') && workflow.includes('attachedViewIds') && !workflow.includes('data-workflow-input={node.id}'))
check('Only Workflow actions own primary flow ports', workflow.includes('className="lcos-workflow-port output"') && workflow.includes('data-workflow-action-input={action.id}'))
check('Material identity comes from physical morphology, not 16x16 file-type glyphs', material.includes('MaterialPaperFallback') && !material.includes('SystemDotGlyph'))
check('16x16 is reserved for LCOS system action/state language', signals.includes('LcosSignalState') && signals.includes("'working'") && signals.includes("'pending'") && surfaceObject.includes('LcosSignalGlyph'))
check('System object identity uses ordinary object glyphs, separate from action signals', surfaceObject.includes('SurfaceIdentityGlyph') && !surfaceObject.includes('SystemDotGlyph'))
check('Search and Focus remain separate', app.includes("if (modifier && key === 'f')") && app.includes("if (key === 'f' && selectedIds.length === 1)"))
check('Semantic Drop browser guard remains', app.includes("window.addEventListener('contextmenu', suppressContextMenu, true)"))

let failed = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  if (!item.ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} LCOS 0.1 GUI semantic contracts passed`)
if (failed) process.exit(1)
