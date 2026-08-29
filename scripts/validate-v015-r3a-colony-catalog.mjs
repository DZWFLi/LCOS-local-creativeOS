import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const exists = (file) => fs.existsSync(file)

const contracts = read('packages/contracts/src/presentations.ts')
const core = read('apps/local-core/src/presentation-application-service.ts')
const coreTest = read('apps/local-core/tests/presentation-persistence.test.ts')
const colony = read('apps/web/src/state/spatialColony.ts')
const storage = read('apps/web/src/state/prototypeStorage.ts')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const catalog = read('apps/web/src/features/spatial/model/surfaceComponentCatalog.ts')
const intent = read('apps/web/src/features/spatial/model/surfaceIntent.ts')
const css = read('apps/web/src/spatial-components.css')

const checks = [
  ['Canonical Colony contract owns sticky members + contour', contracts.includes('export interface PresentationColonyV0') && contracts.includes('memberIds: string[]') && contracts.includes("surface: 'main' | 'context' | 'workflow'") && contracts.includes('contour: { points: Array<{ x: number; y: number }> }')],
  ['Legacy spatial region survives only as deprecated compatibility input', contracts.includes('@deprecated v0.15 compatibility input only') && contracts.includes('spatialRegions?: PresentationSpatialRegionV0[]')],
  ['Core validates canonical Colony identity/membership/contour', core.includes('for (const colony of state.colonies ?? [])') && core.includes('member ids must be non-empty unique strings') && core.includes('requires a closed contour')],
  ['Persistence Golden covers canonical sticky Colony and legacy migration input', coreTest.includes('persists canonical Colony sticky membership and contour') && coreTest.includes('accepts legacy spatial region geometry for one-time migration')],
  ['Old live spatialRegion helper is retired', !exists('apps/web/src/state/spatialRegion.ts')],
  ['Legacy local state preserves colonies absence so migration can run once', storage.includes("...(Array.isArray(parsed.colonies) ? { colonies: parsed.colonies } : {})")],
  ['One-time legacy region migration derives initial members only once', colony.includes('migrateLegacySpatialRegion') && colony.includes('return contour ? { id: region.id')],
  ['Sticky Add uses explicit ids rather than geometry crossing', colony.includes('export function addMembersToColony') && colony.includes('const memberIds = unique([...colony.memberIds, ...ids])')],
  ['Peel requires explicit moved-member distance threshold', colony.includes('export function reconcileColonyAfterMove') && colony.includes('peelDistance = 44') && colony.includes('distanceToPolygon(center, colony.contour.points) > peelDistance')],
  ['Rescope is an explicit lasso replacement operation', colony.includes('export function rescopeColony') && canvas.includes("kind: 'rescope'") && canvas.includes('重新圈定')],
  ['Dissolve removes Colony only and leaves objects untouched', app.includes('const dissolveColony') && app.includes('commitColonies(colonies.filter((item) => item.id !== colonyId))') && app.includes('个对象保留原位')],
  ['Creating a Colony persists initial members and contour', app.includes('createColonyFromCurrentSelection') && app.includes('createColonyFromLasso') && app.includes('commitColonies([...colonies, colony])')],
  ['Drop onto Colony explicitly adds members', canvas.includes("const label = colonyHit ? '加入 Colony'") && canvas.includes('onAddToColony?.(colonyHit.colonyId')],
  ['Ordinary member move settles Peel without live geometry membership recompute', canvas.includes('onColonyMemberMoveSettled?.') && app.includes('settleColonyMemberMove') && !app.includes('spatialRegionBoundsKey')],
  ['Organic Colony contour replaces rectangular spatial-region renderer', canvas.includes('colonyPathData(colony)') && css.includes('.lcos-colony-contour') && css.includes('vector-effect: non-scaling-stroke')],
  ['Selection shortcut and free lasso both create Colony', canvas.includes('圈成 Colony') && canvas.includes('圈一片') && canvas.includes('colonyLassoSession')],
  ['Fence and Region cannot be newly created from Catalog', /fence:[\s\S]{0,360}showInShelf: false[\s\S]{0,180}createMode: 'adapter-only'/.test(catalog) && /region:[\s\S]{0,360}showInShelf: false[\s\S]{0,180}createMode: 'adapter-only'/.test(catalog)],
  ['Retired Context Pack / Compare / generic Workbench stay out of creation Shelf', /'context-pack':[\s\S]{0,420}showInShelf: false[\s\S]{0,180}createMode: 'adapter-only'/.test(catalog) && /compare:[\s\S]{0,420}showInShelf: false[\s\S]{0,180}createMode: 'adapter-only'/.test(catalog) && /workbench:[\s\S]{0,420}showInShelf: false[\s\S]{0,180}createMode: 'adapter-only'/.test(catalog)],
  ['Agent organize/focus-region cannot resurrect legacy Region', intent.includes("if (intent.kind === 'focus-region' || intent.kind === 'organize') return null") && !intent.includes("return 'region'")],
  ['Collection and Colony remain separate interaction paths', canvas.includes('创建 Collection') && canvas.includes('圈成 Colony') && !canvas.includes('转 Collection') && !colony.includes('Collection')],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { pass += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`R3-A Catalog / Colony: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
