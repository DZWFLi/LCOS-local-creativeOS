import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const app = read('apps/web/src/App.tsx')
const host = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const surface = read('apps/web/src/features/execution/surfaceExecution.ts')
const oldSurfaceAgentExists = fs.existsSync('apps/web/src/features/shell/SurfaceAgentNode.tsx')

const checks = [
  ['Context/Workflow render the same UnifiedExecutionComposer', host.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'") && host.includes('<UnifiedExecutionComposer')],
  ['Surface execution uses canonical ConnectedConversation receiver', surface.includes('receiverId: string') && app.includes("receiverRef: { connectedConversationId: input.receiverId }")],
  ['Surface execution carries ordered explicit references', surface.includes('referenceIds: readonly string[]') && app.includes('orderedReferences')],
  ['Surface execution never invents a local session id', !app.includes('surface-agent-') && !host.includes('surface-agent-')],
  ['Reference Pick is local to Surface composer and does not replace primary Selection', host.includes('surfaceReferencePickActive') && host.includes('projectionForRender') && host.includes('toggleSurfaceReference')],
  ['Conversation Reach is read through canonical Core projection', host.includes('onReadReach') && app.includes('conversationReach(activeProjectId, connectedConversationId)')],
  ['Surface ResultSlot remains a destination and fails closed on old proposal seam', host.includes('surfaceResultSlot') && app.includes('Core Proposal 还未携带 ResultSlot')],
  ['Legacy SurfaceAgentNode implementation is removed', !oldSurfaceAgentExists],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`\nCross-Surface Unified Execution F6B: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
