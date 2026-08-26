import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const mini = read('apps/web/src/features/canvas/CanvasMiniMap.tsx')
const spatial = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const collection = read('apps/web/src/features/canvas/collectionExpandLayout.ts')
const geometry = read('apps/web/src/features/canvas/canvasVisualGeometry.ts')
const css = read('apps/web/src/product-interface.css').replace(/\r\n/g, '\n')

const checks = [
  ['dock is local islands, not full glass footer', css.includes('pointer-events: none !important') && css.includes('.vnext-bottom-dock .lcos-lens-axis') && css.includes('background: transparent !important')],
  ['surface host no longer reserves whole dock band', css.includes('.vnext-surface-host.lcos-surface-host {\n  bottom: 0 !important;') || css.includes('.lcos-reconstructed:not([data-layout-mode="sidecar"]) .vnext-surface-host.lcos-surface-host {\n  bottom: 0 !important;')],
  ['selection toolbar size owned by UI scale, not canvas zoom', css.includes('.selection-toolbar.lcos-selection-strip {\n  transform: scale(var(--lcos-ui-scale)) !important;') || css.includes('.lcos-reconstructed:not([data-layout-mode="sidecar"]) .selection-toolbar.lcos-selection-strip {\n  transform: scale(var(--lcos-ui-scale)) !important;')],
  ['main grid snap is persisted and passed to canvas', app.includes("lcos.main.grid-snap") && app.includes('gridSnapEnabled,')],
  ['drag snap uses visible node body', canvas.includes('snapNodePositionToGrid(anchorNode') && geometry.includes('Snap the visible top-left, not the model origin')],
  ['align and distribute use visual bounds, never negative gaps', canvas.includes('nodeVisualBounds(node)') && canvas.includes('const gap = Math.max(18, naturalGap)')],
  ['heterogeneous arrange defaults to visible-body grid', app.includes('layoutVisualGrid(selected') && geometry.includes('Reliable default for heterogeneous material walls')],
  ['relation layouts get visible-body collision repair without rewriting Agent ChangeSets', app.includes('repairVisualLayoutPositions(selected, proposal.positions') && !app.includes('repairVisualLayoutPositions(participants, positions')],
  ['visible snap grid follows camera pan and zoom', canvas.includes('--lcos-main-grid-size') && css.includes('background-position: var(--lcos-main-grid-x) var(--lcos-main-grid-y)')],
  ['collection >9 uses balanced grid', collection.includes('if (members.length > 9)') && collection.includes('layoutBalancedGrid')],
  ['large collection moves whole block around obstacles', collection.includes('candidateOrigins') && collection.includes('Never repair')],
  ['project minimap uses island-sized map and grid toggle', mini.includes('const mapWidth = 152') && mini.includes('map-grid-snap')],
  ['shared spatial minimap can collapse into island', spatial.includes('lcos-spatial-minimap is-collapsed') && spatial.includes('setCollapsed(false)')],
  ['shared minimaps stay above current-scene island', css.includes('.lcos-spatial-minimap {') && css.includes('bottom: 78px !important;')],
]

let failed = 0
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS ${label}`)
  else { console.error(`FAIL ${label}`); failed += 1 }
}
console.log(`Main Canvas Human-Golden static: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
