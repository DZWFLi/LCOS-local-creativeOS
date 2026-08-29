import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const family = read('apps/web/src/features/spatial/spatialNavigationFamily.ts')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const spatialCanvas = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const rail = read('apps/web/src/features/shell/WorkspaceRailVNext.tsx')
const agent = read('apps/web/src/features/shell/AgentContextSurface.tsx')
const markerProvider = read('apps/web/src/features/spatial/ProjectSpatialMarkerContext.tsx')
const markerContract = read('packages/contracts/src/navigation-marker.ts')

const checks = [
  ['one canonical durable Marker provider remains the owner', rail.includes('useProjectSpatialMarkersOrNull') && agent.includes('useProjectSpatialMarkersOrNull') && canvas.includes('useProjectSpatialMarkersOrNull') && markerProvider.includes('client.createSpatialMarker')],
  ['semantic-area overview is camera-driven Presentation only', family.includes('semanticNavigationRegionOverviews') && family.includes("if (zoom >= .55) return []") && !/createSpatialMarker|deleteSpatialMarker|localStorage|sessionStorage/.test(family)],
  ['R3-A canonical Colony may feed semantic overview without a Collection shortcut', canvas.includes("id: `colony:${colony.id}`") && canvas.includes("id: `legacy-region:${element.id}`") && !/entityKind\s*===\s*[\'\"]collection[\'\"][^\n]*colony/i.test(family + canvas)],
  ['semantic-area markers enter the shared SpatialMarkerLayer', canvas.includes('semanticRegionMarkerItems') && canvas.includes('navigationMarkerItems=') && spatialCanvas.includes('unifiedMarkerItems') && spatialCanvas.includes('<SpatialMarkerLayer items={unifiedMarkerItems}')],
  ['semantic-area marker click reuses Focus → Beacon → Arrival rather than direct camera mutation', canvas.includes('navigateSpatialIds(semanticRegionMembersByMarker.get(markerId)') && canvas.includes('setLocalNavigationRequest') && canvas.includes('useSpatialFocusRequest')],
  ['extreme-far Glyth cluster click reuses the same navigation request', canvas.includes('navigateSpatialIds(cluster.memberIds)') && canvas.includes('靠近这片对话')],
  ['internal navigation keeps Focus/Search critical Glyths independent', canvas.includes('effectiveFocusRequest') && canvas.includes('focusGlythIds') && canvas.includes('isCriticalGlyth')],
  ['Glyth Orbit explicitly toggles a durable landmark', canvas.includes("label: '固定到导航'") && canvas.includes("label: '取消导航地标'") && canvas.includes("scope: 'cross-surface'")],
  ['rail landmark resolves only canonical stable workspace/scope surfaces', family.includes('stableRailSurfaceRef') && family.includes('workspaceId') && family.includes("input.id === `scope:${input.scopeId}`")],
  ['legacy workflow bridge fails closed instead of pretending to be a stable surface', family.includes('return null') && !family.includes('workflow:${')],
  ['rail aggregates resolved child markers by target surface for cross-Surface navigation', rail.includes('markerRecordsForSurface') && rail.includes('record.resolution.target.surfaceRef === surfaceRef') && rail.includes('railMarkerCount(view)')],
  ['rail landmark persistence happens only on explicit user action', rail.includes('toggleRailLandmark(preview)') && !/useEffect\([^)]*createMarker/.test(rail)],
  ['Agent proposal derives marker candidates without a second proposal store', family.includes('agentProposalMarkerTargets') && agent.includes('ContextChangeProposalV1') && !/useState<.*Marker|localStorage|sessionStorage/.test(agent)],
  ['Agent marker intent is written only after the explicit landmark button click', agent.includes('onClick={() => toggleProposalLandmarks(proposal)}') && agent.includes('markerRuntime.createMarker') && !/useEffect\([^)]*createMarker/.test(agent)],
  ['durable intent schema still contains no camera/pin/cluster projection state', (() => { const start = markerContract.indexOf('export interface SpatialMarkerIntentV0'); const end = markerContract.indexOf('/** resolve', start); const intent = markerContract.slice(start, end); return start >= 0 && !/world-pin|edge-cursor|cluster|screenX|screenY|\bzoom\b/.test(intent) })()],
  ['SpatialCanvas never persists ephemeral navigation candidates', spatialCanvas.includes('Never persisted by SpatialCanvas') && !/navigationMarkerItems[\s\S]{0,600}createMarker\(/.test(spatialCanvas)],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { pass += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`R2-C Spatial Navigation Family: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
