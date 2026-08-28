import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const shelf = read('apps/web/src/features/spatial/components/SurfaceComponentShelf.tsx')
const frame = read('apps/web/src/features/spatial/components/SurfaceFrame.tsx')
const layer = read('apps/web/src/features/spatial/components/SurfaceComponentLayer.tsx')
const drop = read('apps/web/src/features/spatial/semanticDrop.ts')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const css = read('apps/web/src/spatial-components.css')

const checks = [
  ['Shelf opens on hover/focus instead of requiring a menu click', shelf.includes('onPointerEnter={keepOpen}') && shelf.includes('onFocusCapture={keepOpen}')],
  ['Shelf material is dragged with a transient ghost', shelf.includes('beginDrag(entry, event)') && shelf.includes('lcos-surface-component-drag-ghost')],
  ['Component release position is converted from screen to Surface world coordinates', shelf.includes('worldPointAt') && shelf.includes('cameraZoom') && shelf.includes('dropOrigin')],
  ['Keyboard creation remains available', shelf.includes("event.key === 'Enter'") && shelf.includes("event.key === ' '")],
  ['Main primary drag commits directly to an explicit external Surface target', canvas.includes('externalProjectViewTargetAt') && canvas.includes('onDirectProjectViewDrop(directMoveHit.target.id')],
  ['Normal Main movement keeps raw free-position coordinates', canvas.includes('dragPoint.current = rawPoint') && !canvas.includes('snapNodePositionToGrid(anchorNode')],
  ['Alignment guides are feedback-only', canvas.includes('alignmentGuideFor') && layer.includes('previewAlignment') && css.includes('Alignment is feedback only')],
  ['Surface component pointercancel restores preview without commit', (() => { const body = frame.match(/const cancel = \(pointer: PointerEvent\) => \{([\s\S]*?)\n\s*\}/)?.[1] ?? ''; return /latestBounds\.current\s*=\s*(?:session|interaction)\.bounds/.test(body) && body.includes('onBoundsPreview?.(null') && !body.includes('onBoundsCommit') && frame.includes("window.addEventListener('pointercancel', cancel)") })()],
  ['Non-main entity primary drag can become direct Semantic Drop only on an external target', drop.includes("'direct-primary'") && drop.includes('rawHit.element !== sourceSurface')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`Spatial Interaction Layer v0.4 static: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
