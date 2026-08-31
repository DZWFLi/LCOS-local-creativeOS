import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const group = read('apps/web/src/features/ui/SelectionGroupActions.tsx')
const interactionCss = read('apps/web/src/interaction-system.css')
const productCss = read('apps/web/src/product-interface.css')
const surfaceCss = read('apps/web/src/surface.css')
const reconstructionCss = read('apps/web/src/reconstruction.css')
const vnextCss = read('apps/web/src/vnext.css')
const browser = read('tests/e2e/orbit-lifecycle.spec.ts')

const oldStripTokens = [canvas, interactionCss, productCss, surfaceCss, reconstructionCss, vnextCss]
  .some((source) => source.includes('selection-toolbar') || source.includes('lcos-selection-strip') || source.includes('lcos-selection-more'))

const requiredActions = [
  'selection-focus',
  'selection-reorganize',
  'selection-colony',
  'selection-align-left',
  'selection-align-center-x',
  'selection-align-right',
  'selection-align-top',
  'selection-align-center-y',
  'selection-align-bottom',
  'selection-distribute-x',
  'selection-distribute-y',
  'selection-reading-mode',
  'selection-create-collection',
  'selection-copy',
  'selection-duplicate-view',
  'selection-remove-view',
]

const checks = [
  [
    'Residual Selection Strip DOM/CSS owner is fully retired',
    !oldStripTokens,
  ],
  [
    'Multi-selection uses a dedicated Selection Field action owner instead of single-object ObjectOrbit',
    canvas.includes("import { SelectionGroupActions, type SelectionGroupAction } from '../ui/SelectionGroupActions'")
      && canvas.includes('<SelectionGroupActions')
      && !group.includes("from './ObjectOrbit'")
      && group.includes('A Selection is a transient spatial session, not a Project object'),
  ],
  [
    'Residual group capabilities are carried forward and multi Focus is restored without a capability vacuum',
    requiredActions.every((id) => canvas.includes(`id: '${id}'`)),
  ],
  [
    'Known-object Project Focus supports one-or-more selected objects in UI and keyboard entry',
    app.includes("onFocusSelection: selectedIds.length > 0 ? () => openProjectFocus() : undefined")
      && app.includes("if (key === 'f' && selectedIds.length > 0) { event.preventDefault(); openProjectFocus(); return }"),
  ],
  [
    'Selection group menu is a registered transient overlay with explicit outside/Esc lifecycle',
    group.includes("kind: 'menu'")
      && group.includes('dismissOnOutside: true')
      && group.includes("import { Menu } from '@base-ui/react/menu'")
      && group.includes('actionsRef.current?.close()')
      && group.includes('selectionKey')
      && canvas.includes("selectionKey={selectedIds.join('\\u001f')}"),
  ],
  [
    'Selection group menu uses frozen local swap motion through Base UI starting/ending transition states',
    group.includes('<Menu.Portal>')
      && interactionCss.includes('[data-starting-style]')
      && interactionCss.includes('[data-ending-style]')
      && interactionCss.includes('var(--lcos-dur-swap-opacity)')
      && interactionCss.includes('var(--lcos-dur-swap-transform)')
      && interactionCss.includes('scale(var(--lcos-swap-scale))'),
  ],
  [
    'Screen-space trigger respects the frozen minimum control target instead of reviving a toolbar island',
    interactionCss.includes('.lcos-selection-group-trigger')
      && interactionCss.includes('width: 36px;')
      && interactionCss.includes('height: 36px;'),
  ],
  [
    'Browser regression covers Orbit dismissal, group owner appearance, and local menu capabilities',
    browser.includes("modifiers: ['Shift']")
      && browser.includes("getByTestId('selection-group-actions')")
      && browser.includes("getByTestId('selection-group-actions-trigger')")
      && browser.includes('data-selection-group-action="selection-reorganize"')
      && browser.includes('data-selection-group-action="selection-copy"'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A10 Selection Group Action Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
