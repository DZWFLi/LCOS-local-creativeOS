import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx')
const surface=read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const contract=read('apps/web/src/features/execution/surfaceExecution.ts')
const composer=read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const checks=[
 ['Conversation Subcanvas renders the same UnifiedExecutionComposer',surface.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'")&&surface.includes('<UnifiedExecutionComposer')],
 ['Conversation execution uses the shared SurfaceExecutionSubmission contract',contract.includes("'conversation'")&&surface.includes("surface: 'conversation'")],
 ['Current Conversation writes its canonical Receiver into shared command state',surface.includes('item.conversationSessionId === conversationId')&&surface.includes('command.onReceiverChange(currentReceiver?.id ?? null)')],
 ['Unlinked Conversation never silently falls back to Project Active Receiver',surface.includes('Do not silently fall back')&&!surface.includes('currentReceiver?.id ?? execution?.activeReceiverId')],
 ['Conversation messages are not forged into Project references while Project refs remain visible',surface.includes('referencePickAvailable={false}')&&surface.includes('execution.command.nodes')&&surface.includes('execution.command.referenceIds')&&!surface.includes('referenceIds={[]}')],
 ['Canvas reference pick is explicitly unavailable rather than fake',composer.includes('referencePickAvailable?: boolean')&&surface.includes('referencePickAvailable={false}')],
 ['Conversation Reach uses the same canonical Core projection',surface.includes('execution.onReadReach(receiverId)')&&app.includes('conversationReach(activeProjectId, connectedConversationId)')],
 ['Conversation execution still passes through Proposal compatibility fail-close',surface.includes('proposalCompatibilityBlockReason')&&app.includes('proposeRun(activeProjectId')],
 ['App injects the same shared command/execution surface',app.includes('conversationScene={conversationSpaceId ? {')&&app.includes('command: sharedComposerCommand')&&app.includes('onSubmit: requestSurfaceAgentRun')],
 ['Conversation prompt explicitly preserves one canonical Conversation truth',app.includes('同一段 canonical Conversation，不创建新的 chat/session truth')],
 ['Conversation Work delegates Overlay Stack ownership to the shared Unified Composer',composer.includes('registerOverlay(overlayId')&&composer.includes("kind: 'popover'")&&!surface.includes('registerOverlay(`conversation-work:')],
 ['Global Esc consults Overlay Stack before exiting the Conversation scene',app.includes('escapeTopOverlay()')&&app.indexOf('escapeTopOverlay()')<app.indexOf('if (isText) return')],
]
let passed=0;for(const [label,ok] of checks){if(ok){passed++;console.log(`PASS ${label}`)}else console.error(`FAIL ${label}`)}
console.log(`\nConversation Subcanvas Unified Execution F6B: ${passed}/${checks.length}`);if(passed!==checks.length)process.exit(1)
