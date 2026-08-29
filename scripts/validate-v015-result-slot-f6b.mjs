import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx'), model=read('apps/web/src/model.ts'), create=read('apps/web/src/features/create/CreateContentDialog.tsx'), projection=read('apps/web/src/features/execution/resultSlotProjection.ts'), visual=read('apps/web/src/features/canvas/CanvasNodeVisual.tsx'), composer=read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx'), draft=read('apps/web/src/features/execution/commandDraft.ts'), css=read('apps/web/src/spatial-components.css'), client=read('apps/web/src/runtime/localCoreClient.ts')
const checks=[
 ['Blank Result is a first-class create choice',create.includes("onCreate('result-slot')")&&create.includes('空白结果')],
 ['Blank Result creation calls authoritative Core service',app.includes('bridgeRef.current.client.createResultSlot(activeProjectId')],
 ['Canvas node carries ResultSlot projection identity only',model.includes('resultSlotId?: string')&&model.includes('ResultSlotV0; this node is only its spatial projection')],
 ['ResultSlot projection is reconciled from Core truth',app.includes('client.resultSlots(activeProjectId)')&&app.includes('reconcileResultSlotProjections(current, slots)')],
 ['Materialized slot reuses canonical Artifact projection',projection.includes('materializedByViewId')&&projection.includes('never\n * creates a second output node')],
 ['Composer exposes Result as destination, not Reference',composer.includes('lcos-result-target')&&draft.includes('.filter((node) => !node.resultSlotId)')],
 ['Only one Blank Result may be used by one Run',app.includes('一次处理只能写入一个空白结果')],
 ['Proposal and Run both carry resultSlotId',client.includes('readonly resultSlotId?: string')&&app.includes('resultSlotId: execution.resultSlotId')&&app.includes('proposal.proposal.resultSlotId')],
 ['Old ResultSlot Proposal blocker is removed',!app.includes('Core Proposal 还未携带 ResultSlot')&&!app.includes('这个结果位目前可以显示，但还不能直接写入')],
 ['Unmaterialized slot has its own restrained visual family',visual.includes("return 'result-slot'")&&visual.includes('ResultSlotObject')&&css.includes('.lcos-result-slot-corner')],
 ['Materialized Artifact returns to native morphology',visual.includes("node.resultSlotStatus !== 'materialized' || !node.artifactId")],
 ['Reduced motion disables ResultSlot spinner',css.includes('prefers-reduced-motion')&&css.includes('.lcos-result-slot-body.is-running')],
]
let passed=0;for(const [label,ok] of checks){if(ok){passed++;console.log(`PASS ${label}`)}else console.error(`FAIL ${label}`)}console.log(`\nResultSlot F6B static gate: ${passed}/${checks.length}`);if(passed!==checks.length)process.exit(1)
