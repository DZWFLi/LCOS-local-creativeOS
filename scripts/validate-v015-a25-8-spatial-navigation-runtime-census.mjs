import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8')
const freeze = read('docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md')
const l0 = read('docs/v015/convergence/LATEST_L0_WORKVIEW_HUD_DIRECT_MANIPULATION_ADDENDUM_20260901.md')
const camera = read('apps/web/src/features/spatial/spatialCamera.ts')
const edge = read('apps/web/src/features/spatial/edgePinGeometry.ts')
const markerSystem = read('apps/web/src/features/spatial/spatialMarkerSystem.ts')
const markerLayer = read('apps/web/src/features/spatial/SpatialMarkerLayer.tsx')
const canvas = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const beacon = read('apps/web/src/features/spatial/SpatialBeaconLayer.tsx')
const edgeAdapter = read('apps/web/src/features/spatial/CanvasEdgePinLayer.tsx')
const mainMinimap = read('apps/web/src/features/canvas/CanvasMiniMap.tsx')
const css = read('apps/web/src/product-interface.css')
const app = read('apps/web/src/App.tsx')
const focusLegacy = read('apps/web/src/features/focus/ProjectFocusNavigator.tsx')
const searchLegacy = read('apps/web/src/features/project/ProjectSearchLens.tsx')
const colorPinContext = read('apps/web/src/features/spatial/ProjectColorPinContext.tsx')
const spatialMarkerContext = read('apps/web/src/features/spatial/ProjectSpatialMarkerContext.tsx')
const closeout = read('docs/v015/convergence/A25_8_SPATIAL_NAVIGATION_RUNTIME_CENSUS_CLOSEOUT_20260901.md')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')

const checks = []
const check = (label, condition) => checks.push([label, Boolean(condition)])

check('freeze requires Map Locator to use viewport safe edge', freeze.includes('attaches to viewport safe edge') && freeze.includes('Map Locator'))
check('latest L0 requires Map Locator and Minimap to use active spatial region', l0.includes('Map Locator/offscreen direction glyphs') && l0.includes('Minimap') && l0.includes('activeSpatialViewport / interactiveCanvasRect'))
check('safe world bounds helper exists without Camera mutation', camera.includes('export function spatialSafeViewportWorldBounds') && !camera.includes('setCamera'))
check('edge locator onscreen test uses active safe world bounds', edge.includes('spatialSafeViewportWorldBounds(camera, viewportSize, safeInsets)'))
check('edge locator ray center is active screen rect center', edge.includes('active.left + active.width / 2') && edge.includes('active.top + active.height / 2'))
check('edge classification uses active safe rect rather than physical viewport', edge.includes('edgePinEdgeForPlacement') && edge.includes('activeScreenRect(viewportSize, safeInsets)'))
check('marker system carries safe insets into projection', markerSystem.includes('readonly safeInsets?: SpatialInsets') && markerSystem.includes('projectSpatialMarker(item, input.camera, input.viewportSize, input.safeInsets)'))
check('marker layer passes safe insets to canonical projection', markerLayer.includes('safeInsets') && markerLayer.includes('projectSpatialMarkers({'))
check('shared SpatialCanvas derives local safe insets from one Active Spatial Viewport', canvas.includes('useActiveSpatialViewport()') && canvas.includes('spatialInsetsWithinRect(activeSpatialViewport, root.getBoundingClientRect())'))
check('shared SpatialCanvas gives safe insets to Beacon and marker families', canvas.includes('<SpatialBeaconLayer beacon={beacon} camera={camera} safeInsets={localSafeInsets}') && canvas.includes('<SpatialMarkerLayer items={unifiedMarkerItems} camera={camera} viewportSize={size} safeInsets={localSafeInsets}'))
check('legacy edge-pin adapter also consumes shared safe insets', canvas.includes('<CanvasEdgePinLayer camera={camera} viewportSize={size} safeInsets={localSafeInsets}') && edgeAdapter.includes('safeInsets={safeInsets}'))
check('Beacon projection forwards safe insets instead of rediscovering edge geometry', beacon.includes('safeInsets={safeInsets}') && !beacon.includes('querySelector'))
check('durable marker click centers on active local region', canvas.includes('localActiveCenter.x - point.x * current.zoom') && canvas.includes('localActiveCenter.y - point.y * current.zoom'))
check('embedded SpatialCanvas minimap camera rect uses safe world bounds', canvas.includes('spatialSafeViewportWorldBounds(camera, viewportSize, safeInsets)'))
check('embedded SpatialCanvas minimap click centers in active region', canvas.includes('viewportCenter.x - worldX * current.zoom') && canvas.includes('viewportCenter.y - worldY * current.zoom'))
check('main minimap publishes generic safe placement variables', mainMinimap.includes("'--lcos-minimap-safe-right'") && mainMinimap.includes("'--lcos-minimap-safe-bottom'"))
check('embedded minimap publishes the same generic safe placement variables', canvas.includes("'--lcos-minimap-safe-right'") && canvas.includes("'--lcos-minimap-safe-bottom'"))
check('minimap CSS consumes generic active safe offsets', css.includes('var(--lcos-minimap-safe-right') && css.includes('var(--lcos-minimap-safe-bottom'))
check('old WorkRail-specific minimap CSS hack is retired', !css.includes(':has(.work-rail'))
check('Search legacy lens is not mounted directly by App', !app.includes('<ProjectSearchLens'))
check('large legacy Focus navigator is not mounted directly by App', !app.includes('<ProjectFocusNavigator'))
check('legacy Focus/Search source remains history/fallback only rather than deleted truth', focusLegacy.includes('ProjectFocusNavigator') && searchLegacy.includes('ProjectSearchLens'))
check('Color Pin and binary Spatial Marker remain separate canonical subsystems', colorPinContext.includes('ProjectColorPinRuntime') && spatialMarkerContext.includes('ProjectSpatialMarkerContextValue') && !colorPinContext.includes('SpatialMarkerIntentV0'))
check('A25-8 closeout records found runtime gaps and bounded repair', closeout.includes('Map Locator / Spatial Marker edge projection') && closeout.includes('Embedded `SpatialCanvas` minimap'))
check('A25-8 closeout does not falsely close Browser/Human acceptance', closeout.includes('BROWSER/HUMAN OPEN') && closeout.includes('A24-8'))
check('Construction Context Index points to A25-8 census and repair', index.includes('# 36. A25-8 pointer') && index.includes('A25_8_SPATIAL_NAVIGATION_RUNTIME_CENSUS_CLOSEOUT_20260901.md'))
check('Mandatory Context requires all future edge HUD consumers to use shared active viewport', mandatory.includes('# 66. A25-8') && mandatory.includes('MUST consume the shared `activeSpatialViewport`'))
check('Responsibility Matrix records A25 source/static chain through A25-8', matrix.includes('A25-1…A25-8'))
check('Night ledger records A25-8 and Phase A human gate next', plan.includes('A25-8 Spatial Navigation runtime/fresh census') && plan.includes('Phase A Human Product Smoke / Admission'))
check('A25-8 adds no new Search/Focus/Color Pin canonical truth', !edge.includes('ColorPin') && !edge.includes('projectSearch') && !edge.includes('projectFocus'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-8-spatial-navigation-active-edge.mjs'], { encoding: 'utf8' })
check('active-edge geometry runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('8/8 PASS'))

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`A25-8 Spatial Navigation Runtime Census Gate: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) {
  if (smoke.status !== 0) console.error(smoke.stderr || smoke.stdout)
  process.exit(1)
}
