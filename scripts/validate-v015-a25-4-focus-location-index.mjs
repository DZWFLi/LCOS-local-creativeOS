import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('apps/web/src/App.tsx')
const adapter = read('apps/web/src/features/focus/projectFocusIndex.ts')
const indexView = read('apps/web/src/features/spatial/CenteredSpatialIndex.tsx')
const css = read('apps/web/src/product-interface.css')
const freeze = read('docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md')
const closeout = read('docs/v015/convergence/A25_4_FOCUS_LOCATION_INDEX_MIGRATION_CLOSEOUT_20260901.md')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')

const checks = []
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) })

check('Focus adapter owns presentation only', adapter.includes('projectFocusLocationIndexItems') && adapter.includes('ProjectFocusLocation') && adapter.includes('CenteredSpatialIndexItem'))
check('each Focus location keeps canonical key as index id', adapter.includes('id: location.key'))
check('current occurrence is preserved as active presentation', adapter.includes('active: location.active'))
check('location hover/title context includes kind and real label', adapter.includes('projectFocusKindLabel(location.kind)') && adapter.includes('${location.label}'))
check('matched count is preserved without inventing new truth', adapter.includes('location.matchedCount > 1') && !adapter.includes('localStorage'))
check('index activation can resolve back to existing Focus truth', adapter.includes('projectFocusLocationForIndexId') && adapter.includes('locations.find'))

check('App feeds existing projectFocusLocations into Focus index adapter', app.includes('projectFocusLocationIndexItems(projectFocusLocations)'))
check('App feeds Focus items only when Focus owns top slot', app.includes("topSpatialIndexOwner === 'focus' ? projectFocusIndexItems"))
check('App preserves current active occurrence id', app.includes('projectFocusActiveLocationId'))
check('App activation reuses existing navigateProjectFocus owner', app.includes('projectFocusLocationForIndexId(projectFocusLocations, id)') && app.includes('navigateProjectFocus(location)'))
check('old large Focus navigator is no longer mounted/imported by App', !app.includes('ProjectFocusNavigator') && !app.includes('<ProjectFocusNavigator'))
check('old single-object location Orbit is no longer mounted/imported by App', !app.includes('ArtifactLocationOrbit') && !app.includes('<ArtifactLocationOrbit'))
check('Focus no longer registers a project-focus child dialog', !app.includes("id: 'project-focus'"))
check('Focus open no longer performs DOM anchor lookup', !app.includes('setProjectFocusAnchor') && !app.includes('projectFocusAnchor'))
check('legacy list-mode state is retired from App', !app.includes('projectFocusListMode') && !app.includes('setProjectFocusListMode'))
check('F hotkey toggles Focus without creating a second UI mode', app.includes("if (projectFocusOpen) { setProjectFocusOverflowOpen(false); setProjectFocusOpen(false) } else openProjectFocus()"))
check('Esc dismisses compact overflow before Focus', app.includes("if (projectFocusOverflowOpen) setProjectFocusOverflowOpen(false); else if (projectFocusOpen) setProjectFocusOpen(false)"))

check('shared centered renderer exposes compact overflow fan', indexView.includes('centered-spatial-index-overflow-fan') && indexView.includes('overflowExpanded'))
check('overflow fan still activates through same item callback', indexView.includes("markerButton(item, props, 'lcos-centered-spatial-index-overflow-item'"))
check('overflow fan is bounded by active spatial viewport width', indexView.includes('--lcos-spatial-index-active-width') && css.includes('var(--lcos-spatial-index-active-width'))
check('overflow is a compact wrapping fan rather than fixed side list', css.includes('.lcos-centered-spatial-index-overflow-fan') && css.includes('flex-wrap: wrap') && !css.includes('.lcos-centered-spatial-index-overflow-fan {\n  position: fixed'))

check('Search still has priority over Focus and Focus truth is not merged', app.includes("searchActive: projectToolsMode === 'search'") && app.includes('focusActive: projectFocusOpen'))
check('Color Pin placeholder truth remains absent', (app.includes('colorPinCount: 0') && app.includes('no placeholder colors')) || (app.includes('colorPinCount: projectColorPinGroupsValue.length') && app.includes('projectColorPinGroups(projectColorPins.records)')))
check('product freeze explicitly retires large Focus list primary presentation', freeze.includes('Retire the current large Focus result list as the primary presentation.'))
check('product freeze keeps click occurrence marker as Focus/Fly-to', freeze.includes('Click occurrence marker:') && freeze.includes('Focus/Fly-to that occurrence.'))
check('A25-4 closeout records primary-owner retirement and compact overflow', closeout.includes('Old Focus primary presentations retired from App') && closeout.includes('Compact `+N` expansion'))
check('Construction Index points to A25-4 and next Search migration', index.includes('# 32. A25-4 pointer') && index.includes('A25-5 Search Result Index Migration'))
check('Mandatory Context freezes Focus -> index -> navigate chain', mandatory.includes('# 62. A25-4') && mandatory.includes('projectFocusLocations') && mandatory.includes('navigateProjectFocus()'))
check('Responsibility Matrix preserves Focus migration through later Search progress', (matrix.includes('A25-4 Focus Location Index migration PASS') && (matrix.includes('Search migration + Color Pin truth OPEN') || (matrix.includes('A25-5 Search Result Index migration PASS') && matrix.includes('Color Pin truth OPEN')))) || matrix.includes('A25-1…A25-5 PASS') || matrix.includes('A25-1…A25-6 PASS') || matrix.includes('A25-1…A25-7 PASS') || matrix.includes('A25-1…A25-8'))
check('Night ledger advances only to Search migration next', plan.includes('A25-4 Focus Location Index Migration              = PASS') && plan.includes('A25-5 Search Result Index Migration               = NEXT'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-4-focus-location-index.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
check('Focus location adapter runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('PASS'))

const failed = checks.filter((item) => !item.condition)
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`)
console.log(`A25-4 Focus Location Index migration gate: ${checks.length - failed.length}/${checks.length} PASS`)
if (failed.length) {
  if (smoke.status !== 0) console.error(smoke.stderr || smoke.stdout)
  process.exit(1)
}
