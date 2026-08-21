import fs from 'node:fs'

const checks = [
  ['Fence contract is durable Presentation geometry', ['packages/contracts/src/presentations.ts', 'spatialRegions?: PresentationSpatialRegionV0[]']],
  ['Fence membership derives from visual geometry', ['apps/web/src/App.tsx', 'const spatialRegionBoundsKey = useMemo']],
  ['Dragging into/out of fence uses node visual center', ['apps/web/src/App.tsx', 'const centerX = body.x + body.width / 2']],
  ['Fence resize previews locally', ['apps/web/src/App.tsx', 'Resize is local interaction preview']],
  ['Fence resize persists on pointer-up', ['apps/web/src/features/canvas/ProjectCanvas.tsx', 'onRegionBoundsCommit?.(region.id, latest)']],
  ['Fence bounds validated by Core', ['apps/local-core/src/presentation-application-service.ts', 'bounds must be positive']],
  ['Web pins react-pdf worker family', ['apps/web/package.json', '"pdfjs-dist": "5.4.296"']],
  ['Node PDF thumbnail does not configure workerSrc', ['apps/local-core/src/preview-worker-service.ts', 'Do not configure workerSrc here']],
  ['Node PDF thumbnail has canvas geometry polyfills', ['apps/local-core/src/preview-worker-service.ts', 'globalThis.DOMMatrix']],
  ['Office thumbnail script is bundled', ['scripts/desktop/prepare-runtime.mjs', "'shell-thumb.ps1'"]],
  ['Runtime verifier requires Office thumbnail script', ['scripts/desktop/verify-runtime.mjs', 'Office thumbnail script']],
  ['Desktop file import accepts 60MB-class documents', ['apps/local-core/src/import-copy-service.ts', '128 * 1024 * 1024']],
  ['Document reader endpoint accepts imported 60MB PPT', ['apps/local-core/src/server.ts', 'MAX_DOCUMENT_PREVIEW_BYTES = 128 * 1024 * 1024']],
  ['PDF/PPT nodes request thumbnail presentation', ['apps/local-core/src/import-copy-service.ts', "['image', 'pdf', 'presentation'].includes(artifact.kind)"]],
  ['PDF wrapper no longer owns rail grid', ['apps/web/src/features/viewer/artifactViewerRegistry.tsx', 'viewer-body lcos-pdf-material-viewer']],
  ['Legacy centered viewer-body layout is neutralized for docs', ['apps/web/src/interaction-system.css', '.lcos-viewer-drawer-content .lcos-pdf-material-viewer']],
  ['Actual PDF Document owns rail grid', ['apps/web/src/features/viewer/artifactViewerRegistry.tsx', 'className="lcos-page-viewer lcos-document-pages"']],
  ['PDF main stage re-fits after document load', ['apps/web/src/features/viewer/artifactViewerRegistry.tsx', '}, [numPages])']],
  ['PDF parse errors are visible', ['apps/web/src/features/viewer/artifactViewerRegistry.tsx', 'onLoadError={(reason) => setPdfError']],
  ['PDF Node regression test exists', ['apps/local-core/tests/preview-worker-service.test.ts', 'renders a PDF thumbnail in Node without configuring a browser worker']],
]

let pass = 0
for (const [label, [file, needle]] of checks) {
  const text = fs.readFileSync(file, 'utf8')
  const ok = text.includes(needle)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) pass += 1
}
console.log(`GUI Human Round 1 Fence+Docs static: ${pass}/${checks.length}`)
if (pass !== checks.length) process.exit(1)
