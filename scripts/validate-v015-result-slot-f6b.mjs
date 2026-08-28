import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') // CRLF checkout 下的行尾归一（Windows portability）
const app = read('apps/web/src/App.tsx')
const model = read('apps/web/src/model.ts')
const create = read('apps/web/src/features/create/CreateContentDialog.tsx')
const projection = read('apps/web/src/features/execution/resultSlotProjection.ts')
const visual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const draft = read('apps/web/src/features/execution/commandDraft.ts')
const css = read('apps/web/src/spatial-components.css')

const checks = [
  ['Blank Result is a first-class create choice', create.includes("onCreate('result-slot')") && create.includes('空白结果')],
  ['Blank Result creation calls authoritative Core service', app.includes('client.createResultSlot(activeProjectId') && app.includes('原型模式不会伪造本地结果位')],
  ['Canvas node carries ResultSlot projection identity only', model.includes('resultSlotId?: string') && model.includes('ResultSlotV0; this node is only its spatial projection')],
  ['ResultSlot projection is reconciled from Core truth', app.includes('client.resultSlots(activeProjectId)') && app.includes('reconcileResultSlotProjections(current, slots)')],
  ['Materialized slot reuses canonical Artifact projection', projection.includes('materializedByViewId') && projection.includes('never\n * creates a second output node')],
  ['Unmaterialized slot has its own restrained visual family', visual.includes("return 'result-slot'") && visual.includes('ResultSlotObject') && css.includes('.lcos-result-slot-corner')],
  ['Materialized Artifact returns to native morphology', visual.includes("node.resultSlotStatus !== 'materialized' || !node.artifactId")],
  ['ResultSlot is excluded from explicit References', draft.includes('.filter((node) => !node.resultSlotId)')],
  ['Composer exposes Result as destination, not Reference', composer.includes('Blank Result 是这次 Return 的明确落点，不是 Reference') && composer.includes('lcos-result-target')],
  ['Only one Blank Result may be used by one Run', app.includes('一次 Run 只能写入一个 Blank Result')],
  ['Run execution envelope already carries resultSlotId', app.includes('resultSlotId: selectionResultSlotNode.resultSlotId') && app.includes('resultSlotId: execution.resultSlotId')],
  ['Old Proposal gap fails closed for ResultSlot', app.includes('Core Proposal 还未携带 ResultSlot') && app.includes('不会绕过 Proposal 直接执行')],
  ['Reduced motion disables ResultSlot spinner', css.includes('prefers-reduced-motion') && css.includes('.lcos-result-slot-body.is-running')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`\nResultSlot F6B static gate: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
