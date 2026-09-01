import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('apps/web/src/App.tsx')
const hook = read('apps/web/src/features/project/projectSearchIndex.ts')
const model = read('apps/web/src/features/project/projectSearchIndexModel.ts')
const input = read('apps/web/src/features/project/ProjectSearchIndexInput.tsx')
const view = read('apps/web/src/features/spatial/CenteredSpatialIndex.tsx')
const primitive = read('apps/web/src/features/spatial/centeredSpatialIndex.ts')
const tools = read('apps/web/src/features/project/ProjectToolsDialog.tsx')
const searchLens = read('apps/web/src/features/project/ProjectSearchLens.tsx')
const css = read('apps/web/src/product-interface.css')
const freeze = read('docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md')
const closeout = fs.existsSync(new URL('../docs/v015/convergence/A25_5_SEARCH_RESULT_INDEX_MIGRATION_CLOSEOUT_20260901.md', import.meta.url))
  ? read('docs/v015/convergence/A25_5_SEARCH_RESULT_INDEX_MIGRATION_CLOSEOUT_20260901.md')
  : ''
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')

const checks = []
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) })

check('product freeze defines compact top-center Search and Search to Focus handoff', freeze.includes('compact top-center Search input') && freeze.includes('Search hands off to Focus'))
check('Search retrieval still uses existing Local Core projectSearch backend', hook.includes('input.client.projectSearch(') && hook.includes("types: ['artifact', 'resource', 'note', 'conversation', 'file']"))
check('Search still fuses existing local Project Focus search entries', hook.includes('searchProjectFocusEntries(') && hook.includes('mergeProjectSearchResults(local, remote)'))
check('Search query truth stays transient in the dedicated hook', hook.includes("const [query, setQuery] = useState('')") && !hook.includes('localStorage') && !hook.includes('createMarker'))
check('Search result model does not create Pin Relation or Selection truth', !model.includes('createMarker') && !model.includes('createRelation') && !model.includes('saveRelation') && !model.includes('selectedIds'))
check('Search results project as readable result identity rather than Color Pin dots', model.includes("presentation: 'result'") && model.includes('shortLabel: item.title') && model.includes('hint: kind'))
check('Search result identity keeps human kind and occurrence count metadata', model.includes('projectSearchHumanKind') && model.includes('item.locationCount'))
check('App invokes the same top-slot arbiter with Search priority', app.includes("searchActive: projectToolsMode === 'search'") && primitive.includes("if (input.searchActive) return 'search'"))
check('App no longer mounts Search as ProjectTools dialog', app.includes("projectTools: projectToolsMode === 'full' ?") && !app.includes("projectTools: projectToolsMode ? {"))
check('legacy ProjectSearchLens remains source-only fallback rather than App primary owner', searchLens.includes('project-search-lens') && !app.includes('<ProjectSearchLens'))
check('ProjectToolsDialog remains available for actual full project tools', tools.includes('export function ProjectToolsDialog') && app.includes("setProjectToolsMode('full')"))
check('App mounts only one centered index shell', (app.match(/<CenteredSpatialIndex\b/g) ?? []).length === 1)
check('Search feeds its results into the one shared centered index', app.includes("items={topSpatialIndexOwner === 'search' ? projectSearchIndex.indexItems"))
check('Search active item is represented by the same slot selection feedback', app.includes("activeId={topSpatialIndexOwner === 'search' ? projectSearchActiveId"))
check('Search control lives inside the centered index instead of a dialog/backdrop', app.includes("control={topSpatialIndexOwner === 'search' ? <ProjectSearchIndexInput") && !input.includes('role="dialog"') && !input.includes('backdrop'))
check('compact Search input handles Arrow navigation Enter and layered Escape', input.includes("event.key === 'ArrowDown'") && input.includes("event.key === 'ArrowUp'") && input.includes("event.key === 'Enter'") && input.includes("event.key === 'Escape'"))
check('Search overflow remains the same compact spatial-index fan', app.includes('projectSearchOverflowOpen') && view.includes('lcos-centered-spatial-index-overflow-fan'))
check('Search result click resolves back to original Search result truth', app.includes('projectSearchResultForIndexId(projectSearchIndex.results, id)'))
check('Search to Focus handoff closes Search before opening Focus', app.includes('closeProjectSearch()') && app.includes('openProjectFocus(item.sourceIds, item.title)'))
check('artifact Search results reuse existing focusArtifactFromSearch handoff', app.includes('focusArtifactFromSearch(item.artifactId, item.title)'))
check('unlocatable Search result stays Search-only and does not fabricate a View', app.includes('它现在还没放在画布上') && !model.includes('scope:create'))
check('Search and Focus remain distinct transient states', app.includes("projectToolsMode === 'search'") && app.includes('projectFocusOpen') && !model.includes('ProjectFocusLocation'))
check('Search results use non-circular result glyph treatment', css.includes('.lcos-centered-spatial-index-item.is-result') && css.includes('border-radius: 3px'))
check('Search input width responds to active Spatial viewport', css.includes('var(--lcos-spatial-index-active-width') && css.includes('.lcos-centered-spatial-index-control'))
check('empty Search still keeps the compact input visible', css.includes('.lcos-centered-spatial-index.is-empty.has-control { visibility: visible; }'))
check('Search result constellation remains bounded under the same primary cap', primitive.includes('CENTERED_SPATIAL_INDEX_PRIMARY_CAP = 7') && app.includes('projectSearchIndex.results.length <= CENTERED_SPATIAL_INDEX_PRIMARY_CAP'))
check('Search does not mutate Camera simply by opening or typing', !hook.includes('setCamera') && !input.includes('setCamera') && !model.includes('setCamera'))
check('A25-5 closeout records migration without claiming Browser/Human acceptance', closeout.includes('SOURCE / STATIC PASS') && closeout.includes('Browser/Human') && closeout.includes('A25-6'))
check('Construction Context Index points to A25-5 Search migration', index.includes('# 33. A25-5 pointer') && index.includes('projectSearchIndex.ts'))
check('Mandatory Context supersedes modal Search presentation', mandatory.includes('# 63. A25-5') && mandatory.includes('Search Result Index'))
check('Responsibility Matrix preserves Search migration through later Color Pin progress', (matrix.includes('A25-5 Search Result Index migration PASS') && matrix.includes('Color Pin truth OPEN')) || matrix.includes('A25-1…A25-5 PASS') || matrix.includes('A25-1…A25-6 PASS') || matrix.includes('A25-1…A25-7 PASS') || matrix.includes('A25-1…A25-8'))
check('Night ledger advances next work to Color Pin after Search', plan.includes('A25-5 Search Result Index Migration               = PASS') && plan.includes('A25-6 Color Pin Truth + Index Migration            = NEXT'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-5-search-result-index.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
check('Search result model runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('PASS'))

const failed = checks.filter((item) => !item.condition)
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`)
console.log(`A25-5 Search result index migration gate: ${checks.length - failed.length}/${checks.length} PASS`)
if (failed.length) {
  if (smoke.status !== 0) console.error(smoke.stderr || smoke.stdout)
  process.exit(1)
}
