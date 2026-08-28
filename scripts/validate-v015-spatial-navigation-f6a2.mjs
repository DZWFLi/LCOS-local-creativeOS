import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const spatialCanvas = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const beacon = read('apps/web/src/features/spatial/SpatialBeaconLayer.tsx')
const semantics = read('apps/web/src/features/spatial/minimapSemantics.ts')
const mainMap = read('apps/web/src/features/canvas/CanvasMiniMap.tsx')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const app = read('apps/web/src/App.tsx')
const locationOrbit = read('apps/web/src/features/focus/ArtifactLocationOrbit.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const interaction = read('apps/web/src/interaction-system.css')
const product = read('apps/web/src/product-interface.css')
const surfaces = [
  'ContextSpaceSurface.tsx',
  'ContextTreeSurface.tsx',
  'ContextFlowSurface.tsx',
  'ContextRelationshipHomeSurface.tsx',
  'WorkflowSurface.tsx',
  'WorkflowGraphSurface.tsx',
].map((name) => [name, read(`apps/web/src/features/surfaces/${name}`)])

const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

check('Beacon is a shared SpatialCanvas overlay, not Main-only', spatialCanvas.includes('SpatialBeaconLayer') && spatialCanvas.includes('beacon?: SpatialBeaconState | null'))
check('Context/Workflow surfaces all render the shared Beacon lifecycle', surfaces.every(([, text]) => text.includes('beacon={spatialFocus.beacon}') && text.includes('onBeaconArrivalEnd={spatialFocus.clearBeacon}')))
check('Main Focus items carry truthful label + silhouette metadata', projectCanvas.includes('label: node.title') && projectCanvas.includes('miniMapVisualKindForNode(node)'))
check('Beacon exposes offscreen object label without becoming a card', beacon.includes('lcos-spatial-beacon-label') && !beacon.includes('Popover') && !beacon.includes('Dialog'))
check('MiniMap uses low-fidelity semantic silhouettes', semantics.includes("'conversation'") && semantics.includes("'image'") && semantics.includes("'context'") && semantics.includes("'workflow'"))
check('Main MiniMap marks semantic kind and transient navigation target', mainMap.includes('data-minimap-kind={miniMapVisualKindForNode(node)}') && mainMap.includes('data-minimap-beacon='))
check('Capability MiniMaps mark semantic kind and Beacon target', spatialCanvas.includes('data-minimap-kind={item.visualKind') && spatialCanvas.includes('data-minimap-beacon={beacon?.target.id === item.id'))
check('MiniMap silhouette CSS covers Conversation and aggregate regions', product.includes('data-minimap-kind="conversation"') && product.includes('data-minimap-kind="context"') && product.includes('data-minimap-kind="workflow"'))
check('Beacon visual is a transient directional cursor with Reduced Motion', interaction.includes('lcos-spatial-beacon-core') && interaction.includes('label-inward-right') && interaction.includes('prefers-reduced-motion'))
check('Single-object Focus is an object-local Location Orbit', locationOrbit.includes('<ObjectOrbit') && app.includes('<ArtifactLocationOrbit'))
check('Location Orbit can fall back to multi-location list without losing Focus', locationOrbit.includes('更多位置') && app.includes('setProjectFocusListMode(true)'))
check('Surface objects expose canonical node anchors for local Orbit navigation', (surfaceObject.match(/data-node-id=\{node\.id\}/g) ?? []).length >= 2)
check('Old Focus list remains only as multi/fallback navigator, not the single-object default', app.includes('projectFocusSourceIds.length === 1') && app.includes(': <ProjectFocusNavigator'))
check('MiniMap never imports/render full CanvasNodeVisual bodies', !mainMap.includes('CanvasNodeVisual') && !spatialCanvas.includes('CanvasNodeVisual'))

let failed = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  if (!item.ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} LCOS v0.15 Spatial Navigation F6A2 contracts passed`)
if (failed) process.exit(1)
