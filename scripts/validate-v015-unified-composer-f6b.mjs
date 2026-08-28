import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const draft = read('apps/web/src/features/execution/commandDraft.ts')
const css = read('apps/web/src/reconstruction.css')

const checks = [
  ['Main uses UnifiedExecutionComposer', canvas.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'") && canvas.includes('<UnifiedExecutionComposer')],
  ['Receiver is Conversation-first, provider remains advanced', composer.includes('Receiver Glyth') && composer.includes('Provider 是执行器，不是用户层 Receiver')],
  ['Explicit References are ordered/removeable', composer.includes('data-reference-order') && composer.includes('onMoveReference') && composer.includes('onRemoveReference')],
  ['Canvas Reference Pick does not mutate primary Selection', canvas.includes('referencePick?.active') && canvas.includes('referencePick.onToggle(node.id)') && canvas.includes('suppressClick.current = node.id')],
  ['Reference Pick has numbered world markers', canvas.includes('lcos-reference-pick-badge') && css.includes('.lcos-reference-pick-badge')],
  ['Selected receiver is removed from explicit refs', draft.includes('receiverSessionId') && draft.includes("node.entityKind === 'conversation'")],
  ['Unlinked selected Glyth fails closed', draft.includes('尚未显式链接 ConnectedConversation') && draft.includes('尚未显式 link-session')],
  ['Unsupported Note/Resource-like refs fail closed instead of inferred aliases', draft.includes('不能猜引用身份') && draft.includes('已阻止伪造引用')],
  ['Run creation carries canonical receiver + ordered refs', app.includes('receiverRef: execution.receiverRef') && app.includes('orderedReferences: execution.orderedReferences')],
  ['Old Artifact-only Proposal gap is explicit blocker', draft.includes('Core Proposal 仍是 Artifact-only') && draft.includes('Core Proposal 还未携带显式 Receiver')],
  ['Conversation Reach is background read projection', app.includes('conversationReach(activeProjectId') && composer.includes('Conversation Reach 是背景可达范围，不等于本次显式 References')],
  ['Reference Pick Escape exits pick only', app.includes("event.key === 'Escape' && referencePickActive") && app.includes('setReferencePickActive(false)')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`\nUnified Composer F6B static gate: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
