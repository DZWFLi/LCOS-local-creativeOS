import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const lod = read('apps/web/src/features/spatial/glythSemanticLod.ts')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const nodeVisual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const glyth = read('apps/web/src/features/conversations/ConversationGlyth.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const contextSpace = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const css = read('apps/web/src/interaction-system.css')
const markerContract = read('packages/contracts/src/navigation-marker.ts')

const checks = [
  ['four camera-driven Glyth LOD states exist', ["'normal'", "'mid'", "'far'", "'extreme-far'"].every((needle) => lod.includes(needle)) && lod.includes('glythSemanticLodForZoom')],
  ['Glyth LOD is presentation-only and contains no Core client writes', !/LocalCoreClient|createSpatialMarker|deleteSpatialMarker|fetch\(|localStorage|sessionStorage/.test(lod)],
  ['critical Glyths include selected, active Receiver identity and Focus/Search target', lod.includes('selectedIds.has(node.id)') && lod.includes('activeConversationId') && lod.includes('focusIds?.has(node.id)')],
  ['extreme-far clustering excludes critical Glyths', lod.includes('criticalIds.has(node.id)') && lod.includes('members.length < 2')],
  ['ProjectCanvas derives ephemeral clusters from camera zoom', projectCanvas.includes("glythLod === 'extreme-far'") && projectCanvas.includes('clusterExtremeFarGlyths(renderNodes, camera, criticalGlythIds)')],
  ['ProjectCanvas keeps active/selected/Focus targets independent', projectCanvas.includes('criticalGlythIds') && projectCanvas.includes('activeConversationId') && projectCanvas.includes('effectiveFocusRequest.ids')],
  ['clustered non-critical Glyths are replaced by semantic cluster presentation only', projectCanvas.includes('clusteredGlythIds.has(node.id)') && projectCanvas.includes('lcos-glyth-semantic-cluster')],
  ['generic overview proxy never erases Conversation identity', projectCanvas.includes("performanceProxy={node.entityKind !== 'conversation'") && surfaceObject.includes("performanceProxy && node.entityKind !== 'conversation'")],
  ['Conversation entityKind bypasses artifact/document visual fallback', nodeVisual.includes("if (props.node.entityKind === 'conversation')") && nodeVisual.includes('resolveNodeCard(props.node)')],
  ['near/mid use living Glyth body while far/extreme-far use identity pin', nodeVisual.includes("glythLod === 'far' || glythLod === 'extreme-far'") && nodeVisual.includes('<ConversationGlythIdentityPin') && nodeVisual.includes("glythLod === 'mid' ? 60 : 72")],
  ['far pin preserves the Conversation silhouette/face', glyth.includes('ConversationGlythIdentityPin') && glyth.includes('<ConversationGlyth conversation={conversation}')],
  ['far pin and clusters use inverse camera scale for fixed screen morphology', nodeVisual.includes("'--glyth-ui-scale'") && projectCanvas.includes("'--glyth-ui-scale'") && css.includes('scale(var(--glyth-ui-scale))')],
  ['camera-driven Context and Workflow surfaces pass zoom into shared material renderer', contextSpace.includes('<SurfaceObject node={item.node} zoom={camera.zoom}') && workflow.includes('<SurfaceObject node={node} zoom={camera.zoom}')],
  ['Conversation host is cardless at all LOD levels', css.includes('.canvas-node[data-entity-kind="conversation"]') && css.includes('background: transparent !important') && css.includes('box-shadow: none !important')],
  ['R2-B does not widen durable Marker intent schema with camera/pin/cluster fields', (() => { const start = markerContract.indexOf('export interface SpatialMarkerIntentV0'); const end = markerContract.indexOf('/** resolve', start); const intent = markerContract.slice(start, end); return start >= 0 && !/glyth|cluster|screenX|screenY|cameraZoom|semanticLod|identityPin/.test(intent) })()],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { pass += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`R2-B Glyth Semantic LOD: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
