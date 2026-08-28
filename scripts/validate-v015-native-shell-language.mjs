import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const rail = read('apps/web/src/features/shell/WorkspaceRailVNext.tsx')
const dock = read('apps/web/src/features/shell/SurfaceDock.tsx')
const glyphs = read('apps/web/src/features/design/LcosGlyphs.tsx')
const canvasVisual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const product = read('apps/web/src/product-interface.css')
const interaction = read('apps/web/src/interaction-system.css')
const spatial = read('apps/web/src/spatial-components.css')
const reconstruction = read('apps/web/src/reconstruction.css')

const checks = [
  ['Rail small seed is a native species object, not RealMemberPreview', rail.includes('function RailMicroObject') && rail.includes('if (!large) return <RailMicroObject view={view}/>')],
  ['Rail large hover still uses truthful member geometry', rail.includes('return <ScenePreview view={view} large/>') && rail.includes('railMemberLayout(members')],
  ['Rail no longer uses generic Waves/Network/Layers3 identity icons', !rail.includes('Waves') && !rail.includes('Network') && !rail.includes('Layers3') && !rail.includes('LayoutDashboard')],
  ['Collection rail seed carries folder/member morphology', rail.includes('lcos-rail-folder-members') && product.includes('.lcos-rail-folder-members')],
  ['Context rail seed carries waveform/matrix grammar', rail.includes('lcos-rail-context-matrix') && glyphs.includes('export const ContextGlyph')],
  ['Workflow rail seed carries segmented path grammar', rail.includes('lcos-rail-workflow-segments') && glyphs.includes('strokeDasharray')],
  ['Old rail badge/corner-glyph system is gone', !rail.includes('lcos-rail-kind-badge') && !rail.includes('lcos-project-view-kind-glyph') && !product.includes('.lcos-rail-kind-badge') && !reconstruction.includes('.lcos-project-view-kind-glyph')],
  ['Real member map CSS is large-preview only', spatial.includes('.lcos-rail-member-map.is-large') && !spatial.includes('.lcos-rail-member-map {')],
  ['Bottom dock keeps exactly Main/Context/Workflow native capability entries', dock.includes("{ id:'main' as const") && dock.includes("{ id:'context' as const") && dock.includes("{ id:'workflow' as const") && dock.includes('data-capability={id}')],
  ['Bottom dock uses native Root/Context/Workflow glyphs', dock.includes('RootGlyph') && dock.includes('ContextGlyph') && dock.includes('WorkflowGlyph')],
  ['Direct-reading text has explicit curtain rail + sheet', canvasVisual.includes('lcos-text-curtain-rail') && canvasVisual.includes('lcos-text-curtain-sheet')],
  ['Text curtain sheet is not a bordered glass card', interaction.includes('.lcos-text-curtain-rail') && /\.lcos-readable-document\s*\{[\s\S]*?border:\s*0;[\s\S]*?clip-path:/.test(interaction)],
  ['Direct-reading note outer shell is transparent', /\.lcos-note-object\.is-direct-reading\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/.test(interaction)],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\nNative Shell Language: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
