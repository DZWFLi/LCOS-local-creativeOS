import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const app = read('apps/web/src/App.tsx')
const conversation = read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const interaction = read('tests/e2e/interaction-foundation.spec.ts')
const orbitE2e = read('tests/e2e/orbit-lifecycle.spec.ts')

const checks = [
  ['Unified Composer registers one overlayStack owner', composer.includes('registerOverlay(overlayId') && composer.includes("kind: 'popover'")],
  ['Composer overlay exposes its real DOM root', composer.includes('element: () => rootRef.current') && composer.includes('ref={rootRef}')],
  ['Esc remains owned by the registered Composer overlay while later transient substates may yield first', composer.includes('onEsc: () => {') && composer.includes('onCloseRef.current()')],
  ['outside press still checks Composer is stack top before any dismiss/cancel decision', composer.includes("stack[stack.length - 1]?.id !== overlayId) return") && composer.includes('dismissTop()')],
  ['outside listener is capture-phase and cleaned up', composer.includes("addEventListener('pointerdown', onOutsidePointerDown, true)") && composer.includes("removeEventListener('pointerdown', onOutsidePointerDown, true)")],
  ['Main multi-selection group actions yield while Composer is dominant', canvas.includes('{!selectionComposer && selectedIds.length > 1 && selectionGroupActionPosition && <SelectionGroupActions')],
  ['opening selection Composer retires NodeInfo first', app.includes('setNodeInfoId(null)\n      setReferencePickActive(false)\n      setSelectionComposerOpen(true)')],
  ['opening NodeInfo retires Composer and Reference Pick first', app.includes('setReferencePickActive(false)\n    setSelectionComposerOpen(false)\n    setNodeInfoId(id)')],
  ['Conversation Subcanvas no longer owns a duplicate Composer registration', !conversation.includes('conversation-work:') && !conversation.includes("register as registerOverlay")],
  ['Composer DOM declares one contextual transient owner marker', composer.includes('data-lcos-transient-owner="selection-composer"')],
  ['browser contract checks Esc while Composer textarea owns focus', interaction.includes("composerInput.focus()") && interaction.includes("await expect(composer).toHaveCount(0)")],
  ['browser contract checks group actions yield and recover around Composer', orbitE2e.includes("await expect(page.getByTestId('selection-group-actions')).toHaveCount(0)") && orbitE2e.includes("await expect(page.getByTestId('selection-group-actions')).toBeVisible({ timeout: 2_000 })")],
  ['A19 transient ownership remains intact when later placement owner is present', composer.includes('registerOverlay(overlayId') && composer.includes('data-lcos-transient-owner="selection-composer"') && canvas.includes('{!selectionComposer && selectedIds.length > 1 && selectionGroupActionPosition && <SelectionGroupActions')],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { console.log(`PASS ${label}`); pass += 1 }
  else console.error(`FAIL ${label}`)
}
console.log(`A19 Selection Composer Transient Owner: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
