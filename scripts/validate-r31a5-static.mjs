import fs from 'node:fs'

const read=(path)=>fs.readFileSync(path,'utf8')
const app=read('apps/web/src/App.tsx')
const workspace=read('apps/web/src/features/workspace/WorkspaceDialog.tsx')
const canvas=read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const navigator=read('apps/web/src/features/focus/ProjectFocusNavigator.tsx')
const focus=read('apps/web/src/state/projectFocus.ts')
const projection=read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const contextFlow=read('apps/web/src/features/surfaces/ContextFlowSurface.tsx')
const focusHook=read('apps/web/src/features/spatial/useSpatialFocusRequest.ts')

const checks=[
  ['Workspace + creates an empty Scene without opening create dialog',
    app.includes('const createEmptyWorkspaceScene = useCallback') &&
    app.includes('onAdd: createEmptyWorkspaceScene') &&
    !app.includes("onAdd: () => setWorkspaceEditor({ mode: 'create' })")],
  ['Workspace + never seeds Scene membership from current Selection',
    app.includes('focusedViewIds: []') &&
    !app.slice(app.indexOf('const createEmptyWorkspaceScene'), app.indexOf('const openCurrentScene')).includes('selectedIds')],
  ['Workspace creation preserves current camera and activates Arrange',
    app.slice(app.indexOf('const buildWorkspaceScene'), app.indexOf('const openCurrentScene')).includes('camera,') &&
    app.slice(app.indexOf('const createEmptyWorkspaceScene'), app.indexOf('const openCurrentScene')).includes("setActiveSurface('arrange')")],
  ['WorkspaceDialog is edit-only and seed choices are removed',
    !workspace.includes('WorkspaceSeedMode') && !workspace.includes("mode: 'create' | 'edit'") &&
    !workspace.includes('当前 Selection') && !workspace.includes('当前画布现场') && !workspace.includes('空白现场')],
  ['Context history branch uses the real Core snapshot branch instead of fabricating a local Workspace',
    app.includes('branchContextSnapshot') && app.includes('历史快照保持只读') &&
    app.includes('resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })')],
  ['Project Focus is a read-only Presentation membership resolver',
    focus.includes('Focus is read-only navigation over Presentation membership') &&
    focus.includes('resolveProjectFocusLocations') &&
    !focus.includes('appendExactPresentation') && !focus.includes('removeProjectPresentation')],
  ['Project Focus covers canvas / Collection / Context / Workflow / Workspace',
    focus.includes("'canvas' | 'collection' | 'context-graph' | 'context' | 'workflow-graph' | 'workflow' | 'workspace'") &&
    app.includes("kind: 'collection'") && app.includes("kind: 'context'") && app.includes("kind: 'workflow'") && app.includes("kind: 'workspace'")],
  ['Main canvas exposes an immediate locate action for Selection',
    canvas.includes('onFocusSelection?: () => void') && canvas.includes('<span>在哪</span>')],
  ['A6 keeps Project Search separate from the location-only Focus navigator',
    !navigator.includes('artifactSearch') && navigator.includes('Object-first locator only') &&
    app.includes("setProjectToolsMode('search')") && app.includes('onSelectSourceIds: (sourceIds, title) => openProjectFocus(sourceIds, title)')],
  ['Keyboard F opens single-entity Focus while Ctrl/Cmd+F opens Project Search',
    app.includes("if (modifier && key === 'f')") && app.includes("if (key === 'f' && selectedIds.length === 1)") &&
    app.includes("setProjectToolsMode('search')") && app.includes('openProjectFocus()')],
  ['Capability surfaces receive camera-only focus requests',
    projection.includes('const focusable={...common,focusRequest:props.focusRequest}') &&
    focusHook.includes('Camera-only focus. It never changes Selection or Presentation membership.')],
  ['Signal Track focus uses its real spatial member items',
    contextFlow.includes("items: spatialMemberItems, testId: 'context-flow-spatial'")],
  ['Focus navigation preserves exact single-entity locator coverage',
    navigator.includes("location.exact ? '全部命中' : `${location.matchedCount}/${location.totalCount} 命中`") &&
    focus.includes('exact: matchedCount === totalCount')],
]

let passed=0
for(const [label,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'}  ${label}`)
  if(ok) passed++
}
console.log(`\n${passed}/${checks.length} R3.1A5 static contracts passed`)
if(passed!==checks.length) process.exit(1)
