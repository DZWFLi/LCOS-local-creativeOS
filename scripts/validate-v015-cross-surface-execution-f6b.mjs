import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx')
const host=read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const surface=read('apps/web/src/features/execution/surfaceExecution.ts')
const oldSurfaceAgentExists=fs.existsSync('apps/web/src/features/shell/SurfaceAgentNode.tsx')
const checks=[
 ['Context/Workflow render the same UnifiedExecutionComposer',host.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'")&&host.includes('<UnifiedExecutionComposer')],
 ['Surface execution uses canonical ConnectedConversation receiver',surface.includes('receiverId: string')&&app.includes("receiverRef: { connectedConversationId: input.receiverId }")],
 ['Surface execution keeps Selection context separate from explicit ordered References',surface.includes('selectionIds: readonly string[]')&&surface.includes('referenceIds: readonly string[]')&&app.includes('explicitExecutionReferenceIds(input.referenceIds, target?.id)')&&app.includes('mergeExecutionContextIds(input.selectionIds, input.referenceIds, target?.id)')],
 ['Surface execution never invents a local session id',!app.includes('surface-agent-')&&!host.includes('surface-agent-')],
 ['Reference Pick is shared command state and does not replace primary Selection',host.includes('command.referencePickActive')&&host.includes('command.onToggleReference')&&!host.includes('surfaceReferenceIds')],
 ['Conversation Reach is read through canonical Core projection',host.includes('onReadReach')&&app.includes('conversationReach(activeProjectId, connectedConversationId)')],
 ['Surface ResultSlot is a destination carried through Proposal and Run',host.includes('surfaceResultSlot')&&app.includes('resultSlotId: execution.resultSlotId')&&!app.includes('这个结果位目前可以显示，但还不能直接写入')],
 ['Legacy SurfaceAgentNode implementation is removed',!oldSurfaceAgentExists],
]
let passed=0;for(const [label,ok] of checks){if(ok){passed++;console.log(`PASS ${label}`)}else console.error(`FAIL ${label}`)}
console.log(`\nCross-Surface Unified Execution F6B: ${passed}/${checks.length}`);if(passed!==checks.length)process.exit(1)
