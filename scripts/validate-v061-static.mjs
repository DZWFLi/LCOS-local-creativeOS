import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const minimap = read('apps/web/src/features/canvas/CanvasMiniMap.tsx')
const dock = read('apps/web/src/features/workspace/WorkspaceDock.tsx')
const navigation = read('apps/web/src/state/projectNavigation.ts')
const frames = read('apps/web/src/state/workspaceFrames.ts')
const model = read('apps/web/src/model.ts')
const pkg = JSON.parse(read('package.json'))

const checks = []
const check = (name, condition, detail = '') => {
  checks.push({ name, ok: Boolean(condition), detail })
}

check('version is 0.6.1', pkg.version === '0.6.1', pkg.version)
check('Project Overview uses null activeWorkspaceId', app.includes('const [workspaceId, setWorkspaceId] = useState<string | null>(null)') && app.includes('activeWorkspaceId: null'))
check('camera has separate navigation persistence', navigation.includes('local-creative-os.navigation.v1') && app.includes('saveProjectNavigationState'))
check('camera persistence is silent and separate from prototype save', app.includes('saveProjectNavigationState(activeProjectIdRef.current, cameraRef.current)'))

const saveEffectStart = app.indexOf('if (performanceFixture || presentationInteractionRef.current) return')
const saveEffectEnd = app.indexOf('useEffect(() => { cameraRef.current = camera', saveEffectStart)
const semanticSaveEffect = saveEffectStart >= 0 && saveEffectEnd > saveEffectStart ? app.slice(saveEffectStart, saveEffectEnd) : ''
check('project mutation save effect does not reference camera', semanticSaveEffect.length > 0 && !/\bcamera\b/.test(semanticSaveEffect))
check('presentation interaction suppresses live autosave', app.includes('presentationInteractionRef.current') && app.includes('setPresentationCommit'))

check('CanvasWorld alone carries camera scale', canvas.includes('data-testid="canvas-world"') && canvas.includes('scale(${camera.zoom})'))
check('Canvas HUD lives outside CanvasWorld', app.includes('className="canvas-hud"') && app.includes('<CanvasMiniMap nodes={nodes}'))
check('node resize has live dimensions and end commit', canvas.includes('resizeCandidate.current') && canvas.includes("finishPresentationInteraction('node-resize')"))
check('workspace group drag has one end commit', canvas.includes('workspaceDrag.current') && canvas.includes("finishPresentationInteraction('workspace-group-move')"))
check('workspace group drag does not rewrite membership', !frames.includes('workspaceIds:') && frames.includes('moveWorkspaceMembers'))
check('workspace locate is distinct from activation', dock.includes('onLocate') && dock.includes('onChange') && app.includes('const locateWorkspace') && app.includes('const changeWorkspace'))
check('workspace activation does not set camera', (() => {
  const start = app.indexOf('const changeWorkspace')
  const end = app.indexOf('const locateWorkspace', start)
  return start >= 0 && end > start && !app.slice(start, end).includes('setCamera(')
})())
check('minimap is built from full project nodes', app.includes('<CanvasMiniMap nodes={nodes}') && minimap.includes('nodes.map((node) =>'))
check('minimap has camera viewport rectangle', minimap.includes('data-testid="minimap-camera-rect"') && minimap.includes('viewWorld'))
check('minimap navigation changes only camera locally', minimap.includes('setCamera') && !minimap.includes('savePrototypeState') && !minimap.includes('semanticGraphVersion'))
check('workspace frames derive from membership rather than camera', frames.includes('workspaceMemberIds') && !/workspace\.camera/.test(frames))
check('legacy Workspace.camera retained only as compatibility field', model.includes('legacy v0.6 viewport field'))
check('domain has no React Flow import', !read('packages/domain/src/index.ts').includes('@xyflow/react'))
check('ReactFlow toObject is not persisted', !app.includes('toObject()'))

let failed = 0
for (const item of checks) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` · ${item.detail}` : ''}`)
}
console.log(`\n${checks.length - failed}/${checks.length} static contracts passed`)
if (failed) process.exit(1)
