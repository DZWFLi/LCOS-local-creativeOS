import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const web = path.join(root, 'apps/web/src')
const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8')
const files = {
  dock: read('features/shell/SurfaceDock.tsx'),
  canvas: read('features/canvas/ProjectCanvas.tsx'),
  dialog: read('features/conversations/ConversationContextDialog.tsx'),
  workflow: read('features/surfaces/WorkflowSurface.tsx'),
  graph: read('features/surfaces/ContextGraphSurface.tsx'),
  workspace: read('features/workspace/WorkspaceDialog.tsx'),
  rail: read('features/workrail/WorkRail.tsx'),
  app: read('App.tsx'),
  css: read('reconstruction.css'),
}
const checks = [
  ['bottom has Arrange', files.dock.includes("label:'整理'")],
  ['bottom has Context', files.dock.includes("label:'上下文'")],
  ['bottom has Workflow', files.dock.includes("label:'工作流'")],
  ['bottom has no Run label', !files.dock.includes("label:'运行'")],
  ['bottom has no Deliver label', !files.dock.includes("label:'交付'")],
  ['legacy work/deliver normalize to workflow', files.dock.includes("surface === 'work'") && files.dock.includes("return 'workflow'")],
  ['workflow is free project-defined canvas', files.workflow.includes('项目自己定义怎么工作') && !files.workflow.includes('lcos-work-lanes')],
  ['workspace intent picker removed', !files.workspace.includes('understand') && !files.workspace.includes('explore') && files.workspace.includes('onSave: (input: { label: string })')],
  ['conversation history is single-session', files.dialog.includes('这里只记录这一条导入对话')],
  ['conversation change rail exists', files.dialog.includes('conversation-change-rail') && files.dialog.includes('conversation-change-marker')],
  ['decision UI neutralized', files.dialog.includes('标为重点') && !files.dialog.includes('提升为决策')],
  ['project snapshots not projected as context history', files.app.includes('the user-facing Context history belongs to one imported conversation') && files.app.includes('history: []')],
  ['graph filters derive from real edges', files.graph.includes('new Set(props.edges.map((edge)=>edge.kind))')],
  ['Run lives in right list', files.rail.includes('data-testid="run-list"')],
  ['workflow CSS has real DOM', files.workflow.includes('lcos-workflow-stage') && files.css.includes('.lcos-workflow-stage')],
  ['context free CSS has real DOM', read('features/surfaces/ContextFlowSurface.tsx').includes('lcos-context-free-stage') && files.css.includes('.lcos-context-free-stage')],
  ['run list CSS has real DOM', files.rail.includes('lcos-run-list') && files.css.includes('.lcos-run-list')],
  ['change rail CSS has real DOM', files.dialog.includes('conversation-change-rail') && files.css.includes('.conversation-change-rail')],
  ['top icons gap 8', files.css.includes('.vnext-project-actions { margin-left:auto; display:flex; align-items:center; gap:8px;')],
  ['projection controls gap 6', files.css.includes('.lcos-projection-switch { position:relative; display:flex; align-items:center; gap:6px;')],
  ['anchor inverse-scale', files.css.includes('scale(calc(.8 / var(--canvas-zoom)))')],
  ['selection inverse-scale', files.css.includes('scale(calc(1 / var(--canvas-zoom)))')],
  ['canvas reserves dock', files.css.includes('bottom:var(--lcos-dock-h) !important')],
  ['drop zone equals auto-pan 96', files.canvas.includes('const edge = 96') && files.canvas.includes('rect.bottom - 96') && files.canvas.includes('rect.left + 96')],
  ['drop stage keeps separate anchor', files.canvas.includes('dropStageAnchor.current = anchor')],
  ['drop gutter extinguishes outside', files.canvas.includes('离开边缘后 gutter 必须立即熄灭') && files.canvas.includes('setDropGutter(null)')],
  ['real nodes restored for staging', files.canvas.includes('restoreDraggedOriginals') && files.canvas.includes('originals: groupIds.map')],
  ['direct destination release', files.canvas.includes("window.setTimeout(() => hit.click(), 0)")],
  ['reduced motion preserved', files.css.includes('@media (prefers-reduced-motion:reduce)')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
if (failed) process.exit(1)
