import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const app = read('apps/web/src/App.tsx')
const surface = read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const contract = read('apps/web/src/features/execution/surfaceExecution.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')

const checks = [
  ['Conversation Subcanvas renders the same UnifiedExecutionComposer', surface.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'") && surface.includes('<UnifiedExecutionComposer')],
  ['Conversation execution uses the shared SurfaceExecutionSubmission contract', contract.includes("'conversation'") && surface.includes("surface: 'conversation'")],
  ['Current Conversation defaults the Receiver through canonical conversationSessionId', surface.includes('item.conversationSessionId === conversationId') && surface.includes('setReceiverId(currentReceiver?.id ?? null)')],
  ['Unlinked Conversation never silently falls back to Project Active Receiver', surface.includes('Do not silently fall back') && !surface.includes('currentReceiver?.id ?? execution?.activeReceiverId')],
  ['Conversation Message bubbles are not forged into Project references', surface.includes('nodes={[]}') && surface.includes('referenceIds={[]}') && surface.includes('Message 不是 Project Entity')],
  ['Canvas reference pick is explicitly unavailable rather than fake', composer.includes('referencePickAvailable?: boolean') && surface.includes('referencePickAvailable={false}')],
  ['Conversation Reach uses the same canonical Core projection', surface.includes('execution.onReadReach(receiverId)') && app.includes('conversationReach(activeProjectId, connectedConversationId)')],
  ['Conversation execution still passes through Proposal compatibility fail-close', surface.includes('proposalCompatibilityBlockReason') && app.includes('proposeRun(activeProjectId')],
  ['App injects the same receiver/provider/run execution surface', app.includes('conversationScene={conversationSpaceId ? {') && app.includes('onSubmit: requestSurfaceAgentRun')],
  ['Conversation prompt explicitly preserves one canonical Conversation truth', app.includes('同一段 canonical Conversation，不创建新的 chat/session truth')],
  ['Conversation Work registers with the shared Overlay Stack', surface.includes('registerOverlay(`conversation-work:') && surface.includes("kind: 'popover'")],
  ['Global Esc consults Overlay Stack before exiting the Conversation scene', app.includes('escapeTopOverlay()') && app.indexOf('escapeTopOverlay()') < app.indexOf('if (isText) return')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`\nConversation Subcanvas Unified Execution F6B: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
