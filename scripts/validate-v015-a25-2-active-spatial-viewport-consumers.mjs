import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const owner = read('apps/web/src/features/spatial/activeSpatialViewport.ts')
const context = read('apps/web/src/features/spatial/ActiveSpatialViewportContext.tsx')
const observer = read('apps/web/src/features/spatial/useObservedActiveSpatialViewport.ts')
const app = read('apps/web/src/App.tsx')
const minimap = read('apps/web/src/features/canvas/CanvasMiniMap.tsx')
const focus = read('apps/web/src/features/spatial/useSpatialFocusRequest.ts')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const workRail = read('apps/web/src/features/workrail/WorkRail.tsx')
const workspaceRail = read('apps/web/src/features/shell/WorkspaceRailVNext.tsx')
const workspaceDock = read('apps/web/src/features/workspace/WorkspaceDock.tsx')
const l0 = read('docs/v015/convergence/LATEST_L0_WORKVIEW_HUD_DIRECT_MANIPULATION_ADDENDUM_20260901.md')
const closeout = read('docs/v015/convergence/A25_2_ACTIVE_SPATIAL_VIEWPORT_CONSUMER_MIGRATION_CLOSEOUT_20260901.md')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')

const checks = []
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) })

check('pure owner exposes surface-local inset projection', owner.includes('export function spatialInsetsWithinRect'))
check('pure owner exposes client edge bounds projection', owner.includes('export function spatialEdgeBoundsWithinRect'))
check('react context carries one active viewport environment', context.includes('ActiveSpatialViewportContext.Provider'))
check('observer uses generic persistent occupant attribute', observer.includes('data-spatial-viewport-occupant'))
check('observer does not hard-code WorkRail selector', !observer.includes('work-rail') && !observer.includes('workspace-dock'))
check('observer owns no Camera mutation', !observer.includes('setCamera') && !observer.includes('Camera'))
check('observer watches occupant resize', observer.includes('ResizeObserver'))
check('App derives active viewport from static shell insets', app.includes('useObservedActiveSpatialViewport({ viewportWidth, viewportHeight, staticInsets: staticSpatialInsets })'))
check('App compatibility safeInsets come from active viewport', app.includes('const safeInsets = activeSpatialViewport.activeInsets'))
check('App provides active viewport to nested Surfaces', app.includes('<ActiveSpatialViewportProvider value={activeSpatialViewport}>'))
check('old shellWorkingCenter camera shove retired', !app.includes('shellWorkingCenter'))
check('minimap no longer accepts independent safeInsets prop', !minimap.includes('safeInsets: SafeInsets'))
check('minimap consumes shared active viewport', minimap.includes('useActiveSpatialViewport()') && minimap.includes('spatialInsetsWithinRect'))
check('Focus consumes shared active viewport', focus.includes('useActiveSpatialViewport()') && focus.includes('spatialInsetsWithinRect'))
check('Focus fit uses active insets', focus.includes('fitSpatialBounds(bounds, width, height, paddingRef.current ?? 90, insets)'))
check('Project edge-scroll consumes shared active viewport', projectCanvas.includes('useActiveSpatialViewport()') && projectCanvas.includes('spatialEdgeBoundsWithinRect'))
check('Project edge-scroll no longer queries old dock/rail DOM', !projectCanvas.includes("querySelector<HTMLElement>('[data-testid=\"workspace-dock\"]')") && !projectCanvas.includes("querySelector<HTMLElement>('[data-testid=\"work-rail\"]')"))
check('current right rail declares viewport occupancy', workRail.includes('data-spatial-viewport-occupant="right"'))
check('current project rail declares viewport occupancy', workspaceRail.includes('data-spatial-viewport-occupant="left"'))
check('legacy workspace dock declares viewport occupancy', workspaceDock.includes('data-spatial-viewport-occupant="left"'))
check('latest L0 requires HUD and edge systems to consume dynamic region', l0.includes('activeSpatialViewport / interactiveCanvasRect'))
check('latest L0 forbids automatic Camera mutation', l0.includes('NO automatic Camera mutation'))

check('A25-2 closeout records narrow consumer migration and human debt', closeout.includes('SOURCE / STATIC PASS · HUMAN VISUAL ACCEPTANCE OPEN') && closeout.includes('A25-3 · Centered Spatial Index Presentation Owner'))
check('Construction Context Index points at A25-2 exact owner/consumer files', index.includes('# 30. A25-2 pointer') && index.includes('useObservedActiveSpatialViewport.ts'))
check('Mandatory Context bans component-specific safe-area rediscovery', mandatory.includes('# 60. A25-2') && mandatory.includes('MUST NOT query WorkRail/WorkspaceDock/UnifiedWorkView by component name'))
check('Responsibility Matrix preserves A25-2 consumer migration through later legal progress', (matrix.includes('A25-2 App/Minimap/Focus/edge-auto-pan consumer migration PASS') && matrix.includes('Centered Index UI/Focus/Search migration/Pin truth OPEN')) || (matrix.includes('A25-2 consumer migration PASS') && matrix.includes('A25-3 Centered Spatial Index presentation owner PASS') && matrix.includes('Focus/Search consumer migration + Color Pin truth OPEN')) || (matrix.includes('A25-2 consumer migration PASS') && matrix.includes('A25-4 Focus Location Index migration PASS') && matrix.includes('Search migration + Color Pin truth OPEN')) || (matrix.includes('A25-2 consumer migration PASS') && matrix.includes('A25-5 Search Result Index migration PASS') && matrix.includes('Color Pin truth OPEN')) || (matrix.includes('A25-1…A25-5 PASS') && matrix.includes('A25-6 Color Pin canonical truth/index SOURCE/STATIC PASS')) || matrix.includes('A25-1…A25-6 PASS') || matrix.includes('A25-1…A25-7 PASS') || matrix.includes('A25-1…A25-8'))
check('Night ledger advances to A25-3 only', plan.includes('A25-2 Active Spatial Viewport Consumer Migration  = PASS') && plan.includes('A25-3 Centered Spatial Index Presentation Owner   = NEXT'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-2-active-spatial-viewport-consumers.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
check('consumer geometry runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('PASS'))

const failed = checks.filter((item) => !item.condition)
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`)
console.log(`A25-2 active viewport consumer migration gate: ${checks.length - failed.length}/${checks.length} PASS`)
if (failed.length) {
  if (smoke.status !== 0) console.error(smoke.stderr || smoke.stdout)
  process.exit(1)
}
