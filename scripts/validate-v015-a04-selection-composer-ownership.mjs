import fs from 'node:fs'

const app = fs.readFileSync('apps/web/src/App.tsx', 'utf8').replace(/\r\n/g, '\n')
const interactionE2e = fs.readFileSync('tests/e2e/interaction-foundation.spec.ts', 'utf8').replace(/\r\n/g, '\n')

const checks = [
  [
    'ordinary selection cannot turn a closed Composer into an open Composer',
    app.includes('setSelectionComposerOpen((current) => current && !additive && selectedIds.includes(id))')
      && !app.includes("setSelectionComposerOpen(layoutMode === 'desktop' && !additive && selectedIds.includes(id))"),
  ],
  [
    'explicit composer focus remains the owner that opens the selection Composer',
    app.includes('const requestComposerFocus = useCallback(() => {')
      && app.includes('setSelectionComposerOpen(true)')
      && app.includes("document.querySelector<HTMLTextAreaElement>('[data-testid=\"selection-composer-input\"]')"),
  ],
  [
    'browser regression guard reselects the same node after the double-press window and expects Composer closed',
    interactionE2e.includes('await page.waitForTimeout(500)')
      && interactionE2e.includes("await expect(page.getByTestId('selection-composer')).toHaveCount(0)"),
  ],
  [
    'double-click remains a separate deeper-view gesture rather than a Composer gesture',
    app.includes('const handleDoubleClick = useCallback((id: string) => {')
      && app.includes('setSelectionComposerOpen(false)'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) {
    passed += 1
    console.log(`PASS ${label}`)
  } else {
    console.error(`FAIL ${label}`)
  }
}

console.log(`A04 Selection Composer Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
