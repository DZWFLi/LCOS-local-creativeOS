import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const placement = read('apps/web/src/features/ui/spatialOverlayPlacement.ts')
const environment = read('apps/web/src/features/ui/spatialOverlayEnvironment.ts')
const placementTest = read('apps/web/src/features/ui/__tests__/spatialOverlayPlacement.test.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const nodeInfo = read('apps/web/src/features/canvas/NodeInfoPopover.tsx')

const checks = [
  ['one canonical SpatialOverlayPlacement resolver exists', placement.includes('export function resolveSpatialOverlayPlacement')],
  ['placement contract accepts visual target/overlay/viewport/safe/occupied/preferred inputs', ['targetBounds','overlaySize','viewport','safeInsets','occupiedRects','preferredSide'].every((token) => placement.includes(token))],
  ['placement works in screen-space without mutating model geometry', placement.includes('screen-space geometry owner') && !placement.includes('CanvasNode') && !placement.includes('setNodes')],
  ['placement scores target/occupied collisions and nearest distance deterministically', placement.includes('intersectionArea') && placement.includes('euclideanDistance') && placement.includes('SIDE_ORDER') && placement.includes('seen = new Set')],
  ['shared environment measures Dock/Rail/Minimap and transient occupied rects', ['.lcos-bottom-dock','.lcos-workspace-rail','.work-rail:not(.collapsed)','.minimap','.lcos-orbit-layer'].every((selector) => environment.includes(selector))],
  ['NodeInfo uses visual bounds rather than persisted generic node rect', nodeInfo.includes('nodeVisualBounds(node)') && nodeInfo.includes('visualBounds.width * camera.zoom')],
  ['NodeInfo measures real overlay size and delegates placement', nodeInfo.includes('new ResizeObserver(measure)') && nodeInfo.includes('resolveSpatialOverlayPlacement({') && nodeInfo.includes('collectSpatialOverlayOccupiedRects(viewport, popoverRef.current)')],
  ['NodeInfo legacy manual right/left/above clamp is retired', !nodeInfo.includes('preferLeft') && !nodeInfo.includes('preferAbove') && !nodeInfo.includes('window.innerWidth - width')],
  ['Main Composer target is visual Selection bounds in screen space', canvas.includes('selectionComposerTargetBounds = selectedVisualBounds && canvasScreenRect') && canvas.includes('selectedVisualBounds.width * camera.zoom')],
  ['Main Composer delegates occupied-aware placement instead of viewport clamp', canvas.includes('selectionComposerSpatialPlacement') && canvas.includes('collectSpatialOverlayOccupiedRects') && !canvas.includes('overlayHeight - 128') && !canvas.includes('Math.min(430, overlayWidth - 24)')],
  ['Unified Composer measures its rendered size and consumes canonical placement', composer.includes('measuredOverlaySize') && composer.includes('new ResizeObserver(measure)') && composer.includes('resolveSpatialOverlayPlacement({ ...props.spatialPlacement, overlaySize: measuredOverlaySize })')],
  ['Composer keeps legacy x/y only as fallback for non-migrated surfaces', composer.includes('spatialPlacement ? spatialPlacement.left') && composer.includes(': props.x') && composer.includes(': props.y')],
  ['placement exposes side/free evidence for runtime visual QA', composer.includes('data-spatial-placement-side') && nodeInfo.includes('data-spatial-placement-side') && composer.includes('data-spatial-placement-free') && nodeInfo.includes('data-spatial-placement-free')],
  ['unit contract covers preferred/free, occupied fallback, safe inset and determinism', ['uses the preferred side','preferred side is occupied','safe insets','deterministic'].every((text) => placementTest.includes(text))],
  ['A20 leaves Base UI / Orbit positioning architecture out of the migration', !placement.includes('ObjectOrbit') && !placement.includes('Menu.Positioner')],
]

let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) pass += 1
}
console.log(`A20 SpatialOverlayPlacement Owner: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
