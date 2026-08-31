import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const host = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const semanticDrop = read('apps/web/src/features/spatial/semanticDrop.ts')
const menu = read('apps/web/src/features/shell/SurfaceContextMenu.tsx')
const projection = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const app = read('apps/web/src/App.tsx')
const browser = read('tests/e2e/right-click-ownership.spec.ts')

const checks = [
  ['Shared scene host owns object contextmenu across the three Project surfaces',
    host.includes("target.closest<HTMLElement>('[data-node-id]')")
      && host.includes("kind: 'object'")
      && host.includes("props.surface === 'arrange'")
      && host.includes("const sceneSelect = props.surface === 'arrange' ? props.canvas.onSelect : props.projection.onSelect")
      && host.includes('sceneSelect(anchorId, false)')],
  ['A22 object menu is management-only and no longer duplicates Action Arc Open/Focus/Pin/Relation',
    host.includes("action: 'rename' as const")
      && host.includes("action: 'copy' as const")
      && host.includes("'remove-reference' as const : 'add-reference' as const")
      && host.includes("action: 'remove-projection' as const")
      && !host.includes("action: 'focus' as const")
      && !host.includes("'unpin' as const : 'pin' as const")
      && !host.includes("action: 'assembly' as const")
      && !host.includes("action: 'relation' as const")],
  ['Conversation remains receiver identity and is not silently treated as explicit Reference',
    host.includes("filter((node) => node.entityKind !== 'conversation')")],
  ['Right-clicking an already-selected member preserves the multi-selection; another object becomes sole selection',
    host.includes('sceneSelectedIds.includes(anchorId) && sceneSelectedIds.length > 1')
      && host.includes('sceneSelect(anchorId, false)')],
  ['Orbit yields before management context menu becomes the dominant transient layer',
    host.includes("if (top?.kind === 'orbit') dismissTop()")
      && menu.includes("kind: 'menu'")
      && menu.includes('dismissOnOutside: true')],
  ['Main CanvasCard allows contextmenu to bubble to the shared owner',
    canvas.includes('onContextMenu={(event) => event.preventDefault()} onPointerDown=')
      && !canvas.includes('onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerDown={(event) => { if (!node.disabled) onPointerDown(event) }}')],
  ['A09 ordinary-object Focus callback is actually destructured by ProjectCanvas instead of existing only in Props/call-sites',
    canvas.includes('onDoubleClick, onDetails, onFocusSelection, onRequestSelectionComposer, onFocusNode, onCreateNodeFromAnchor')],
  ['Simple secondary click is not stolen by Semantic Drop; native menu guard starts only after movement threshold',
    canvas.includes("if (trigger !== 'secondary-pointer') event.preventDefault()")
      && canvas.includes("Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 4")
      && canvas.indexOf("window.addEventListener('contextmenu', guard, true)") > canvas.indexOf('Math.hypot(event.clientX - item.startX')
      && semanticDrop.includes("if (trigger !== 'secondary-pointer') event.preventDefault()")
      && semanticDrop.includes('installMenuGuard()')
      && semanticDrop.indexOf('installMenuGuard()') > semanticDrop.indexOf('Math.hypot(pointerEvent.clientX - startX')],
  ['Context/Workflow projection exposes multi Focus and remove-projection owners wired to canonical presentation helpers',
    projection.includes('onFocusSelection?:(ids:readonly string[])=>void')
      && projection.includes('onRemoveProjection?:(ids:readonly string[])=>void')
      && app.includes('onFocusSelection: (ids) => openProjectFocus(ids)')
      && app.includes("removeExactPresentationMembers('workflow', ownerId, semantic.viewIds)")
      && app.includes("removeExactPresentationEntityRefs('context', ownerId, semantic.entityRefs")
      && app.includes('Project Entity 保持不变')],
  ['Browser regression encodes simple right-click vs right-drag and three-surface object ownership',
    browser.includes("button: 'right'")
      && browser.includes("data-context-menu-scope=\"对象\"")
      && browser.includes("menu.locator('[data-context-menu-action=\"focus\"]')).toHaveCount(0)")
      && browser.includes("menu.locator('[data-context-menu-action=\"pin\"], [data-context-menu-action=\"unpin\"]')).toHaveCount(0)")
      && browser.includes('lcos-semantic-drop-ghost')
      && browser.includes("name: '上下文'")
      && browser.includes("name: '工作流'")],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A11 Universal Right-click Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
