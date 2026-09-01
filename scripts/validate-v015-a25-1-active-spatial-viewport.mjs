import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const source = fs.readFileSync(new URL('../apps/web/src/features/spatial/activeSpatialViewport.ts', import.meta.url), 'utf8')
const l0 = fs.readFileSync(new URL('../docs/v015/convergence/LATEST_L0_WORKVIEW_HUD_DIRECT_MANIPULATION_ADDENDUM_20260901.md', import.meta.url), 'utf8')
const freeze = fs.readFileSync(new URL('../docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md', import.meta.url), 'utf8')

const checks = []
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) })

check('exports canonical resolver', source.includes('export function resolveActiveSpatialViewport'))
check('defines activeSpatialRect', source.includes('activeSpatialRect'))
check('defines topCenterAnchor', source.includes('topCenterAnchor'))
check('defines edgeBounds', source.includes('edgeBounds'))
check('defines staticInsets', source.includes('staticInsets'))
check('defines persistentOccupiedRects', source.includes('persistentOccupiedRects'))
check('defines activeInsets compatibility projection', source.includes('activeInsets'))
check('supports explicit occupied edge', source.includes('readonly edge?: SpatialViewportEdge'))
check('supports inferred edge for existing persistent chrome', source.includes('inferOccupiedEdge'))
check('floating center obstacle does not automatically become edge owner', source.includes('return touched.length === 1 ? touched[0]! : null'))
check('resolver has no Camera import', !/import[^\n]*Camera/.test(source))
check('resolver has no setCamera mutation', !source.includes('setCamera'))
check('resolver has no DOM query ownership', !source.includes('querySelector'))
check('resolver has no Work View component dependency', !/WorkView|UnifiedWorkView|DockedWork/.test(source))
check('latest L0 requires activeSpatialViewport', l0.includes('activeSpatialViewport / interactiveCanvasRect'))
check('latest L0 forbids automatic Camera mutation on Work View resize', l0.includes('NO automatic Camera mutation'))
check('freeze requires visual canvas top-center', freeze.includes('centered on the visual canvas'))
check('freeze separates shared presentation from canonical truth', freeze.includes('Shared presentation primitive does not imply shared canonical truth'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-1-active-spatial-viewport.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
check('geometry runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('PASS'))

const failed = checks.filter((item) => !item.condition)
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`)
console.log(`A25-1 activeSpatialViewport gate: ${checks.length - failed.length}/${checks.length} PASS`)
if (failed.length) process.exit(1)
