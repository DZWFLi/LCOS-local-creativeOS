import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const draft = read('apps/web/src/features/execution/commandDraft.ts')
const host = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const e2e = read('tests/e2e/interaction-foundation.spec.ts')
const unit = read('apps/web/tests/commandDraft.test.ts')

const checks = [
  [
    'explicit Reference helper consumes only referenceIds and never Selection',
    draft.includes('export function explicitExecutionReferenceIds(')
      && draft.includes('for (const id of referenceIds)')
      && !/explicitExecutionReferenceIds\([\s\S]{0,180}selectionIds/.test(draft),
  ],
  [
    'foreground execution context has a separate Selection + Reference merge helper',
    draft.includes('export function mergeExecutionContextIds(')
      && draft.includes('for (const id of [...selectionIds, ...referenceIds])'),
  ],
  [
    'Main execution orderedReferences are derived from explicit Reference state only',
    app.includes('explicitExecutionReferenceIds(selectionReferenceIds, selectionTargetNode?.id)')
      && !app.includes('mergeExecutionReferenceIds(selectedIds, selectionReferenceIds'),
  ],
  [
    'Main execution context still carries Selection separately from explicit References',
    app.includes('mergeExecutionContextIds(selectedIds, selectionReferenceIds, selectionTargetNode?.id)')
      && app.includes('const contextNodes = selectionExecutionContextNodes'),
  ],
  [
    'Context/Workflow surface validation uses explicit Reference IDs only',
    host.includes('explicitExecutionReferenceIds(command?.referenceIds ?? [], surfaceTarget?.id)')
      && !host.includes('mergeExecutionReferenceIds(command?.selectionIds'),
  ],
  [
    'Surface execution submission keeps Selection as foreground context while orderedReferences stay explicit',
    app.includes('explicitExecutionReferenceIds(input.referenceIds, target?.id)')
      && app.includes('mergeExecutionContextIds(input.selectionIds, input.referenceIds, target?.id)'),
  ],
  [
    'Composer user language explicitly says Selection does not become Reference',
    composer.includes('当前选择的 ${selected.length} 项是直接处理对象，不会自动记入参考。'),
  ],
  [
    'unit and browser guards assert Selection count differs from Reference count',
    unit.includes("keeps ordinary Selection out of the explicit Reference set")
      && e2e.includes("await expect(composer.locator('[data-reference-id]')).toHaveCount(0)")
      && e2e.includes("await second.click({ modifiers: ['Control'] })")
      && e2e.includes("await expect(composer.locator('[data-reference-id]')).toHaveCount(1)"),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A05 Selection Reference Separation: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
