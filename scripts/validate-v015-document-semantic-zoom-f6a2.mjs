import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const visual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const zoom = read('apps/web/src/features/spatial/documentSemanticZoom.ts')
const labels = read('apps/web/src/features/spatial/SpatialLabelSystem.ts')
const css = read('apps/web/src/interaction-system.css')
const editor = read('apps/web/src/features/ui/InlineNoteEditor.tsx')

const checks = [
  ['Document LOD has named Near/Mid/Far semantic levels', zoom.includes("'full' | 'outline' | 'title'") && zoom.includes('DOCUMENT_SEMANTIC_ZOOM')],
  ['Outline is derived from canonical Markdown headings', zoom.includes('extractDocumentHeadings') && zoom.includes('const match = raw.match(/^\\s*(#{1,3})\\s+')],
  ['Mid LOD prefers H1/H2 structure instead of scaled body text', zoom.includes('heading.depth <= 2') && visual.includes('lcos-document-outline-preview')],
  ['Main passes world camera zoom into canonical CanvasNodeVisual', canvas.includes('density={density} zoom={zoom}')],
  ['Far LOD uses title identity instead of decorative fake text lines', visual.includes("level === 'title'") && visual.includes('lcos-document-title-identity')],
  ['Spatial labels have one shared priority vocabulary', labels.includes('SPATIAL_LABEL_PRIORITY') && labels.includes('beacon: 1000') && labels.includes('selected: 900')],
  ['Spatial label contract separates navigation/world collision groups', labels.includes("'navigation' | 'world-label'")],
  ['Spatial label core contains no hand-rolled DOM collision algorithm', !labels.includes('getBoundingClientRect') && !labels.includes('intersects') && !labels.includes('overlap')],
  ['Markdown input shortcuts promote #/##/###/- into structured blocks', editor.includes('applyMarkdownShortcut') && editor.includes("prefix === '###'") && editor.includes("prefix === '-'")],
  ['Pasted multi-line Markdown keeps heading/list block types', editor.includes('applyParsedMarkdownBlock(div, parseMarkdownBlockLine')],
  ['CSS only styles document LOD bodies and does not implement collision placement', css.includes('Document Semantic Zoom') && !css.includes('spatial-label-collision-fallback')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`\nDocument Semantic Zoom F6A2: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
