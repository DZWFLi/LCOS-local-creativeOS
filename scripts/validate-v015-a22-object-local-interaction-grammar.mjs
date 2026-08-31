import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const orbit = read('apps/web/src/features/ui/ObjectOrbit.tsx')
const orbitCss = read('apps/web/src/features/ui/ui-primitives.css')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const projectOrbit = read('apps/web/src/features/ui/ProjectObjectOrbit.tsx')
const sceneHost = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const menu = read('apps/web/src/features/shell/SurfaceContextMenu.tsx')
const frame = read('apps/web/src/features/spatial/components/SurfaceFrame.tsx')
const componentCss = read('apps/web/src/spatial-components.css')
const interactionCss = read('apps/web/src/interaction-system.css')
const orbitTest = read('apps/web/src/features/ui/__tests__/ObjectOrbit.test.tsx')
const orbitE2e = read('tests/e2e/orbit-lifecycle.spec.ts')
const rightClickE2e = read('tests/e2e/right-click-ownership.spec.ts')

const selectionActions = read('apps/web/src/features/ui/SelectionGroupActions.tsx')

const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

check('A22 retires the full 360-degree Orbit contract',
  orbit.includes('visual top-right corner 的短弧') &&
  !orbit.includes('SATELLITE_RING_GAP') &&
  !orbit.includes('angleStep') && !orbit.includes('Math.PI * 2 / total'))

check('A22 caps direct Action Arc actions at four',
  orbit.includes('export const MAX_VISIBLE_SATELLITES = 4') &&
  orbitTest.includes('expect(MAX_VISIBLE_SATELLITES).toBe(4)'))

check('Action Arc uses deterministic corner templates rather than trigonometric ring placement',
  orbit.includes('const templates: Record<number') &&
  !orbit.includes('Math.cos(') && !orbit.includes('Math.sin('))

check('Action Arc labels are hover/focus disclosure rather than permanent text chrome',
  /\.lcos-orbit-satellite-label\s*\{[\s\S]*?opacity:\s*0/.test(orbitCss) &&
  orbitCss.includes('.lcos-orbit-satellite:hover .lcos-orbit-satellite-label'))

check('Compact Composer may coexist with the selected object Action Arc',
  projectCanvas.includes('Compact Composer and the selected object\'s Action Arc may coexist') &&
  !projectCanvas.includes('if (!selectionComposerVisible) return'))

check('Stable single-click on content-like Main objects can request the local Composer',
  projectCanvas.includes('projectNodeSupportsInlineComposer') &&
  projectCanvas.includes('onRequestSelectionComposer?.(node.id)'))

check('Structural aggregate/workspace projections do not auto-open generic Composer',
  projectCanvas.includes("node.entityKind === 'collection' || node.entityKind === 'context' || node.entityKind === 'workflow'") &&
  projectCanvas.includes("node.id.startsWith('workspace:') || node.id.startsWith('scope:')"))

check('Right-click no longer duplicates Open/Focus/Pin direct actions',
  !sceneHost.includes("action: 'open' as const") &&
  !sceneHost.includes("action: 'focus' as const") &&
  !sceneHost.includes("action: allMenuPinned ? 'unpin' as const : 'pin' as const") &&
  !menu.includes("| 'open'") && !menu.includes("| 'focus'") && !menu.includes("| 'pin'"))

check('Right-click keeps management commands instead of becoming empty',
  sceneHost.includes("action: 'rename' as const") &&
  sceneHost.includes("action: 'copy' as const") &&
  (sceneHost.includes("action: 'duplicate-view' as const") || sceneHost.includes("action: allMenuReferences")))

check('Project Object Arc still owns direct Open/Relation/Pin/Locate capabilities',
  projectOrbit.includes("id: 'object-open'") &&
  projectOrbit.includes("id: 'object-relation'") &&
  projectOrbit.includes("id: 'object-pin'") &&
  projectOrbit.includes("id: 'object-locate'"))

check('Multi-selection restores individual plus aggregate spatial feedback',
  interactionCss.includes('.canvas-node.multi-selected') &&
  interactionCss.includes('.selection-bounds') &&
  !interactionCss.includes('Individual selected objects recede'))

check('Selection actions are compacted instead of vertically enumerating the entire Inspector-like list',
  selectionActions.includes('lcos-selection-group-quick') &&
  selectionActions.includes('lcos-selection-layout-grid') &&
  interactionCss.includes('.lcos-selection-layout-grid { display:grid; grid-template-columns:repeat(3'))

check('Generic Component permanent mini-window chrome is retired',
  frame.includes('Component = Spatial Instrument, not a mini window') &&
  !frame.includes('showPin') &&
  !componentCss.includes('.lcos-surface-component-toolbar') &&
  componentCss.includes('generic permanent ○/−/× Component chrome is retired'))

check('Component collapse becomes a Map Locator projection instead of an empty mini-bar',
  frame.includes('lcos-component-map-locator') &&
  frame.includes("if (collapsed)") &&
  frame.includes('lcos-component-locator-anchor') &&
  !componentCss.includes('.lcos-surface-component-frame.is-collapsed'))

check('Expanded Component direct actions anchor to the Component body while collapsed actions anchor to the Locator',
  frame.includes('anchorRef={frameRef}') &&
  frame.includes('anchorRef={locatorRef}'))

check('Component management stays in Right-click/More',
  frame.includes('lcos-component-management-menu') &&
  frame.includes("id: 'component-more'") &&
  frame.includes('固定位置') && frame.includes('从当前现场移除'))

check('Component management outside dismissal is top-owner aware',
  frame.includes('queryStack()') && frame.includes('stack[stack.length - 1]?.id !== menuOverlayId'))

check('Layered Esc/outside regression spec keeps Composer above Action Arc',
  orbitE2e.includes('layered Esc closes Composer before the Arc') &&
  orbitE2e.includes('await expect(orbitLayer).toBeVisible'))

check('Right-click browser contract forbids Focus/Pin/Relation duplication',
  rightClickE2e.includes('data-context-menu-action="focus"') &&
  rightClickE2e.includes('toHaveCount(0)') &&
  rightClickE2e.includes('data-context-menu-action="relation"'))

let failed = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  if (!item.ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} A22 Object-local Interaction Grammar contracts passed`)
if (failed) process.exit(1)
