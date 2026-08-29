import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const client = read('apps/web/src/runtime/localCoreClient.ts')
const contract = read('packages/contracts/src/navigation-marker.ts')
const markerSystem = read('apps/web/src/features/spatial/spatialMarkerSystem.ts')
const markerContext = read('apps/web/src/features/spatial/ProjectSpatialMarkerContext.tsx')
const spatialCanvas = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const app = read('apps/web/src/App.tsx')
const route = read('apps/local-core/src/routes/navigation-markers.ts')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const contextSpace = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const conversation = read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')

const checks = [
  ['LocalCoreClient exposes marker list/create/delete/resolve', ['listSpatialMarkers(', 'createSpatialMarker(', 'deleteSpatialMarker(', 'resolveNavigationTarget('].every((needle) => client.includes(needle))],
  ['LocalCoreClient uses real Core marker endpoints', client.includes('/spatial-markers') && client.includes('/navigation/resolve')],
  ['Web imports canonical marker contracts', markerSystem.includes("from '@local-creative-os/contracts'") && markerSystem.includes('SpatialMarkerIntentV0') && markerSystem.includes('SpatialMarkerTargetRefV0')],
  ['duplicate frontend future Marker contract is retired', !markerSystem.includes('export interface SpatialMarkerIntentV0') && !markerSystem.includes('export interface SpatialMarkerTargetRefV0') && !markerSystem.includes('future Core contract')],
  ['canonical local marker source surface uses StableSurfaceRefV0', contract.includes('readonly sourceSurfaceRef?: StableSurfaceRefV0')],
  ['Core rejects GUI/test ids as durable source surfaces', route.includes('isStableSurfaceRef') && route.includes("String(input.scope) === 'local'") && route.includes('sourceSurfaceRef must resolve to a stable surface')],
  ['Project marker owner reads intents then resolves canonical targets', markerContext.includes('client.listSpatialMarkers') && markerContext.includes('client.resolveNavigationTarget') && markerContext.includes('ProjectSpatialMarkerProvider')],
  ['Project marker owner never stores projection state', !/localStorage|sessionStorage/.test(markerContext) && !/\bzoom\b|screenX|screenY|clusterMembership/.test(markerContext)],
  ['App installs one project-level durable Marker owner', app.includes('<ProjectSpatialMarkerProvider') && app.includes('projectId={activeProjectId}')],
  ['SpatialCanvas consumes durable intent through shared SpatialMarkerLayer', spatialCanvas.includes('useProjectSpatialMarkersOrNull') && spatialCanvas.includes('durableMarkerItems') && spatialCanvas.includes('<SpatialMarkerLayer') && spatialCanvas.includes('resolveMarker(markerId)')],
  ['SpatialCanvas has canonical surfaceRef instead of persisting testId', spatialCanvas.includes('surfaceRef?: StableSurfaceRefV0') && spatialCanvas.includes("testId === 'canvas' ? 'main'")],
  ['Main/Context/Workflow/Conversation pass stable surface refs', projectCanvas.includes("surfaceRef={surfaceMode === 'project' ? 'main' : undefined}") && contextSpace.includes('surfaceRef={`scope:${props.scopeId}`}') && workflow.includes('surfaceRef={`scope:${props.scopeId}`}') && conversation.includes('surfaceRef={conversationId ? `conversation:${conversationId}` : undefined}')],
  ['Main durable Marker follows live Presentation bounds without copying coordinates to Core', projectCanvas.includes('markerAnchorItems={') && projectCanvas.includes('spatialCanvasItems') && spatialCanvas.includes('markerAnchorItems ?? marqueeItems ?? minimapItems')],
  ['durable Marker click re-resolves before camera movement', spatialCanvas.includes('markerRuntime.resolveMarker(markerId).then') && spatialCanvas.includes('resolution.target.worldPosition')],
  ['R2-A does not persist pin/cursor/cluster/x/y/zoom in Marker intent', (() => { const start = contract.indexOf('export interface SpatialMarkerIntentV0'); const end = contract.indexOf('/** resolve', start); const intent = contract.slice(start, end); return start >= 0 && !/world-pin|edge-cursor|cluster|screenX|screenY|\bzoom\b/.test(intent) })()],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { pass += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`R2-A Marker Core ↔ Web Bridge: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
