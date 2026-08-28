import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const foundation = read('apps/web/src/foundation.css')
const reconstruction = read('apps/web/src/reconstruction.css')
const product = read('apps/web/src/product-interface.css')
const interaction = read('apps/web/src/interaction-system.css')

const checks = [
  ['Single Selection is a local field, not a rectangular border', interaction.includes('Selection is a local field in the world') && interaction.includes('conic-gradient(from 26deg') && /\.canvas-node\.selected \.lcos-object::after \{[^}]*border:0;[^}]*background:conic-gradient/.test(interaction)],
  ['Multi Selection uses one shared field rather than a filled bounds rectangle', /\.selection-bounds \{[\s\S]*?border:0;[\s\S]*?background:transparent;/.test(interaction) && interaction.includes('.selection-bounds::before') && interaction.includes('.selection-bounds::after')],
  ['Individual nodes recede inside a shared multi-selection field', interaction.includes('.canvas-node.multi-selected.selected .lcos-object::before { opacity:.26; }') && interaction.includes('.canvas-node.multi-selected.selected .lcos-object::after { opacity:.18; }')],
  ['Edge labels reveal only under relationship attention', canvas.includes('visibleLabel && !dimmed && (selected || focused)')],
  ['Active relation motion lives in the line; legacy edge runner is gone', !canvas.includes('edge-runner') && interaction.includes('@keyframes lcos-relation-flow') && interaction.includes('.edge.active')],
  ['Selected edge endpoints render Light Segment marks with invisible hit areas', canvas.includes('edge-terminal-hit') && canvas.includes('edge-terminal-mark') && interaction.includes('.edge-terminal-hit { fill:transparent; stroke:transparent; }') && interaction.includes('stroke:var(--lcos-segment-on)')],
  ['Temporary and reconnect edges share one live relation motion', interaction.includes('.edge.temporary') && interaction.includes('animation:lcos-relation-live') && interaction.includes('.edge.temporary.reconnecting')],
  ['Selected relation gets one-shot commit sweep', interaction.includes('@keyframes lcos-edge-commit') && interaction.includes('animation:lcos-edge-commit 460ms')],
  ['Relation visual ownership is removed from reconstruction/product layers', !reconstruction.includes('.vnext-surface-host .edges .edge') && !reconstruction.includes('.edge-terminal') && !product.includes('.vnext-surface-host .edges .edge') && !product.includes('.edge-controls {')],
  ['Foundation relation CSS is geometry-only; interaction owns visible stroke', /\.edge \{[\s\S]*?stroke:\s*transparent;/.test(foundation) && interaction.includes('.vnext-surface-host .edges .edge {')],
  ['Relation receptive target remains local and explicitly animated', interaction.includes('.canvas-node.is-relation-target > .lcos-object::before') && interaction.includes('@keyframes lcos-relation-receptive')],
  ['Reduced Motion disables relation animation', interaction.includes('@media (prefers-reduced-motion: reduce)') && interaction.includes('.vnext-surface-host .edges .edge { animation:none !important; }')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\nSelection + Relation F4: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
