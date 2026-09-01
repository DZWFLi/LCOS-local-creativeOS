import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const primitive = read('apps/web/src/features/spatial/centeredSpatialIndex.ts')
const view = read('apps/web/src/features/spatial/CenteredSpatialIndex.tsx')
const app = read('apps/web/src/App.tsx')
const css = read('apps/web/src/product-interface.css')
const freeze = read('docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md')
const closeout = read('docs/v015/convergence/A25_3_CENTERED_SPATIAL_INDEX_PRESENTATION_OWNER_CLOSEOUT_20260901.md')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')
const focusMigrated = fs.existsSync(new URL('../docs/v015/convergence/A25_4_FOCUS_LOCATION_INDEX_MIGRATION_CLOSEOUT_20260901.md', import.meta.url))
const searchMigrated = fs.existsSync(new URL('../docs/v015/convergence/A25_5_SEARCH_RESULT_INDEX_MIGRATION_CLOSEOUT_20260901.md', import.meta.url))

const checks = []
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) })

check('one owner enum covers Search Focus Color Pin Assembly without shared truth', primitive.includes("'search' | 'focus' | 'color-pin' | 'assembly' | 'none'"))
check('normal surface arbitration is Search over Focus over Color Pin', primitive.includes("if (input.searchActive) return 'search'") && primitive.includes("if (input.focusActive) return 'focus'") && primitive.includes("if (input.colorPinCount > 0) return 'color-pin'"))
check('no content yields no owner', primitive.includes("return 'none'"))
check('primary constellation cap is seven', primitive.includes('CENTERED_SPATIAL_INDEX_PRIMARY_CAP = 7'))
check('layout uses deterministic templates rather than left-origin row math', primitive.includes('const TEMPLATES') && !primitive.includes('justifyContent'))
check('overflow reserves a centered constellation slot', primitive.includes('overflowOffset') && primitive.includes('primaryCap - 1'))
check('presentation consumes active viewport top-center anchor', view.includes('useActiveSpatialViewport()') && view.includes('environment?.topCenterAnchor'))
check('presentation owns no Search Focus or Pin canonical state', !view.includes('useState(') && !view.includes('localStorage') && !view.includes('createMarker'))
check('presentation exposes winner identity for future consumers', view.includes('data-spatial-index-owner={props.owner}'))
check('empty slot renders no placeholder marker', view.includes("is-empty") && css.includes('.lcos-centered-spatial-index.is-empty { visibility: hidden; }'))
check('slot is viewport-fixed and screen-space', css.includes('.lcos-centered-spatial-index {') && css.includes('position: fixed;'))
check('slot anchor comes from geometry variables', css.includes('--lcos-spatial-index-anchor-x') && css.includes('--lcos-spatial-index-anchor-y'))
check('constellation rebalances with bounded local transition', css.includes('left .22s') && css.includes('top .22s'))
check('reduced motion disables constellation transition', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('transition: none'))
check('App wires live Search and Focus activity into single arbiter', app.includes("searchActive: projectToolsMode === 'search'") && app.includes('focusActive: projectFocusOpen'))
check('App does not invent placeholder Color Pin truth', (app.includes('colorPinCount: 0') && app.includes('no placeholder colors')) || (app.includes('colorPinCount: projectColorPinGroupsValue.length') && app.includes('projectColorPinGroups(projectColorPins.records)')))
check('App mounts exactly one centered index shell', (app.match(/<CenteredSpatialIndex\b/g) ?? []).length === 1)
check('A25-3 preserves staged consumer retirement through later legal migration', (app.includes('<ProjectFocusNavigator') || (focusMigrated && !app.includes('<ProjectFocusNavigator'))) && (app.includes("projectTools: projectToolsMode ?") || (searchMigrated && app.includes("projectTools: projectToolsMode === 'full' ?"))))
check('product freeze defines one dominant slot and distinct truths', freeze.includes('Only one dominant index owner may occupy the primary slot at a time.') && freeze.includes('Color Pin truth ≠ Focus state ≠ Search state ≠ Assembly taxonomy'))
check('A25-3 closeout keeps consumer migration staged', closeout.includes('SOURCE / STATIC PASS · FOCUS/SEARCH/COLOR-PIN CONSUMER MIGRATION OPEN') && closeout.includes('A25-4'))
check('Construction Context Index points to A25-3 primitive/view', index.includes('# 31. A25-3 pointer') && index.includes('centeredSpatialIndex.ts') && index.includes('CenteredSpatialIndex.tsx'))
check('Mandatory Context freezes one-slot arbitration', mandatory.includes('# 61. A25-3') && mandatory.includes('Search > Focus > Color Pin > none'))
check('Responsibility Matrix preserves A25-3 presentation through later legal progress', ((matrix.includes('A25-3') && matrix.includes('presentation PASS')) || matrix.includes('A25-1…A25-5 PASS') || matrix.includes('A25-1…A25-6 PASS') || matrix.includes('A25-1…A25-7 PASS') || matrix.includes('A25-1…A25-8')) && (matrix.includes('Focus/Search consumer migration + Color Pin truth OPEN') || (matrix.includes('A25-4 Focus Location Index migration PASS') && matrix.includes('Search migration + Color Pin truth OPEN')) || (matrix.includes('A25-5 Search Result Index migration PASS') && matrix.includes('Color Pin truth OPEN')) || matrix.includes('A25-6 Color Pin canonical truth/index SOURCE/STATIC PASS') || matrix.includes('A25-1…A25-6 PASS') || matrix.includes('A25-1…A25-7 PASS') || matrix.includes('A25-1…A25-8')))
check('Night ledger advances only to Focus migration', plan.includes('A25-3 Centered Spatial Index Presentation Owner   = PASS') && plan.includes('A25-4 Focus Location Index Migration              = NEXT'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-3-centered-spatial-index.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
check('centered index geometry/arbitration runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('PASS'))

const failed = checks.filter((item) => !item.condition)
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`)
console.log(`A25-3 centered spatial index presentation gate: ${checks.length - failed.length}/${checks.length} PASS`)
if (failed.length) {
  if (smoke.status !== 0) console.error(smoke.stderr || smoke.stdout)
  process.exit(1)
}
