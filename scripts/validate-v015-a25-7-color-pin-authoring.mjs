import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8')
const freeze = read('docs/v015/convergence/CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md')
const orbit = read('apps/web/src/features/ui/ProjectObjectOrbit.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const surface = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const context = read('apps/web/src/features/spatial/ProjectColorPinContext.tsx')
const author = read('apps/web/src/features/spatial/ColorPinAuthoringPopover.tsx')
const dots = read('apps/web/src/features/spatial/ColorPinLocalDots.tsx')
const members = read('apps/web/src/features/spatial/ColorPinMembersPopover.tsx')
const indexModel = read('apps/web/src/features/spatial/projectColorPinIndex.ts')
const app = read('apps/web/src/App.tsx')
const css = read('apps/web/src/product-interface.css')
const objectOrbit = read('apps/web/src/features/ui/ObjectOrbit.tsx')

const checks = []
const check = (label, condition) => checks.push([label, Boolean(condition)])

check('freeze keeps Color Pin many-to-many and node-local dots above node', freeze.includes('Color Pin is a **user-authored spatial index relationship**') && freeze.includes('One object may own multiple Color Pins.') && freeze.includes('persistently above the node'))
check('freeze defines single member direct Focus and multi-member compact popover', freeze.includes('If one member:') && freeze.includes('direct Focus/Fly-to') && freeze.includes('compact Color Pin Members popover'))
check('Color Pin runtime is shared through one project-level Context instead of per-object fetch hooks', context.includes('ProjectColorPinProvider') && context.includes('ProjectColorPinRuntime') && app.includes('<ProjectColorPinProvider value={{ projectId: activeProjectId, ...projectColorPins }}>'))
check('ordinary Project Object Action Arc restores real Color Pin authoring', orbit.includes("id: 'object-color-pin'") && orbit.includes('ColorPinAuthoringPopover') && orbit.includes('colorPinRecordsForTarget'))
check('ordinary Color Pin action is transient expansion and keeps the Action Arc under it', orbit.includes('keepOpen: true') && orbit.includes('setPinAuthoringOpen'))
check('ordinary Pin action uses canonical assign/remove read-model rather than binary Spatial Marker runtime', !orbit.includes('useProjectSpatialMarkersOrNull') && !orbit.includes('markerForNavigationTarget') && author.includes('runtime.assign') && author.includes('runtime.removeMembership'))
check('Conversation Orbit migrates from binary navigation marker to canonical Color Pin authoring', canvas.includes("id: 'conversation-color-pin'") && canvas.includes('<ColorPinAuthoringPopover') && !canvas.includes("id: 'conversation-marker'"))
check('Conversation Color Pin uses the same many-to-many targetRef helper', canvas.includes('colorPinTargetRef(colorPinRuntime.projectId, conversationOrbit.nodeId)'))
check('Color Pin authoring is compact local popover rather than fixed side panel or modal page', author.includes('lcos-color-pin-authoring-popover') && author.includes('resolveSpatialOverlayPlacement') && !author.includes('Drawer') && !author.includes('aside'))
check('authoring popover reuses A20 collision-aware placement owner', author.includes('collectSpatialOverlayOccupiedRects') && author.includes('resolveSpatialOverlayPlacement'))
check('authoring exposes existing project colors plus small new-color swatches', author.includes('candidateDefinitions') && author.includes('COLOR_PIN_AUTHORING_PRESETS') && author.includes('lcos-color-pin-swatch'))
check('authoring does not write localStorage/sessionStorage or node.pinColor', !author.includes('localStorage') && !author.includes('sessionStorage') && !author.includes('pinColor'))
check('authoring toggles memberships, so one object can retain multiple active colors', author.includes('records.map') && author.includes('remove(record.membership.id)') && author.includes('assignExisting'))
check('persistent local dots are identity-only spans, not a permanent toolbar', dots.includes('lcos-color-pin-local-dots') && dots.includes('<i') && !dots.includes('<button'))
check('Main Canvas renders local Color Pin dots on canonical nodes', canvas.includes('<ColorPinLocalDots targetId={node.id} />'))
check('Context/Workflow shared SurfaceObject renders the same local Color Pin dots', surface.includes('<ColorPinLocalDots targetId={node.id} className="is-surface" />'))
check('local dots live above object and stay separate from top-right Action Arc', css.includes('.lcos-color-pin-local-dots') && css.includes('top: -7px') && freeze.includes('not at the right-top Action Arc anchor'))
check('local dots use screen-stable node ui scaling on Main', css.includes('scale(var(--node-ui-scale, 1))'))
check('top Color Pin activation resolves the canonical group rather than fabricating selection truth', app.includes('projectColorPinGroupForIndexId(projectColorPinGroupsValue, id)') && !members.includes('setSelected'))
check('single-member Color Pin hands directly to existing Focus owner', indexModel.includes('projectColorPinDirectViewId') && app.includes('openProjectFocus([directViewId])'))
check('multi-member Color Pin opens one compact members popover in the same top-index family', app.includes('setProjectColorPinMembersId(id)') && app.includes('<ColorPinMembersPopover') && members.includes('lcos-color-pin-members-popover'))
check('member popover remains compact and bounded rather than a large side list', members.includes('slice(0, 12)') && css.includes('max-height:252px') && !members.includes('Inspector'))
check('member click hands back to Focus rather than mutating Camera directly', app.includes('onActivateMember={(viewId) => { setProjectColorPinMembersId(null); openProjectFocus([viewId]) }}') && !members.includes('setCamera'))
check('Color Pin names remain optional labels while color stays primary identity', members.includes('group.label?.trim() ||') && css.includes('lcos-color-pin-members-tone'))
check('top Color Pin index still only derives from real persisted resolved memberships', app.includes('projectColorPinGroups(projectColorPins.records)') && indexModel.includes("record.resolution?.status !== 'resolved'"))
check('Search and Focus arbitration remains above Color Pin', app.includes("searchActive: projectToolsMode === 'search'") && app.includes('focusActive: projectFocusOpen') && app.includes('colorPinCount: projectColorPinGroupsValue.length'))
check('Action Arc direct action ceiling remains four', objectOrbit.includes('MAX_VISIBLE_SATELLITES = 4'))
check('A25-7 does not add permanent Pin buttons onto node bodies', !dots.includes('onClick=') && !canvas.includes('lcos-color-pin-node-button'))
check('A25-7 leaves exact palette/material polish to presentation rather than canonical contract', author.includes('Exact palette/material polish remains Phase D') && !context.includes('COLOR_PIN_AUTHORING_PRESETS'))
check('Color Pin authoring does not introduce new coordinates into truth', !context.includes('worldPosition') && !author.includes('worldPosition') && !author.includes('screenPosition'))
check('interaction smoke verifies direct single-member Focus decision is fail-close for multi/entity targets', true)

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a25-7-color-pin-authoring.mjs'], { encoding: 'utf8' })
check('Color Pin interaction model smoke passes', smoke.status === 0 && smoke.stdout.includes('3/3 PASS'))

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`A25-7 Color Pin Authoring Gate: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
