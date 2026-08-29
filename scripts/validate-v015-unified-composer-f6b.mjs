import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx'), canvas=read('apps/web/src/features/canvas/ProjectCanvas.tsx'), composer=read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx'), draft=read('apps/web/src/features/execution/commandDraft.ts'), css=read('apps/web/src/reconstruction.css')
const checks=[
 ['Main uses UnifiedExecutionComposer',canvas.includes("import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'")&&canvas.includes('<UnifiedExecutionComposer')],
 ['Receiver is Conversation-first, provider remains advanced',composer.includes('lcos-receiver-select')&&composer.includes('交给哪段对话')&&composer.includes('<span>执行器</span>')],
 ['Explicit References are ordered/removeable',composer.includes('data-reference-order')&&composer.includes('onMoveReference')&&composer.includes('onRemoveReference')],
 ['Selection and explicit References remain separate',composer.includes('当前选择')&&composer.includes('额外参考')&&draft.includes('mergeExecutionReferenceIds')],
 ['Canvas Reference Pick does not mutate primary Selection',canvas.includes('referencePick?.active')&&canvas.includes('referencePick.onToggle(node.id)')&&canvas.includes('suppressClick.current = node.id')],
 ['Reference Pick has numbered world markers',canvas.includes('lcos-reference-pick-badge')&&css.includes('.lcos-reference-pick-badge')],
 ['Selected receiver is removed from explicit refs',draft.includes('receiverSessionId')&&draft.includes("node.entityKind === 'conversation'")],
 ['Unlinked selected Glyth fails closed',draft.includes('选中的对话还没有完成连接')&&draft.includes('还没有完成连接，请先连接后再使用')],
 ['Unsupported identities fail closed instead of inferred aliases',draft.includes('这类对象目前还不能安全加入本次参考')],
 ['Run creation carries canonical receiver + ordered refs',app.includes('receiverRef: execution.receiverRef')&&app.includes('orderedReferences: execution.orderedReferences')],
 ['Proposal supports heterogeneous refs and non-active Receiver',!draft.includes('input.receiverId !== input.activeReceiverId')&&!draft.includes("orderedReference?.ref.type !== 'artifact'")],
 ['Conversation Reach is background, not explicit Reference truth',composer.includes('长期材料')&&composer.includes('不等于你这次明确选中的参考')],
 ['Reference Pick Escape exits pick only',app.includes("event.key === 'Escape' && referencePickActive")&&app.includes('setReferencePickActive(false)')],
]
let passed=0;for(const [label,ok] of checks){if(ok){passed++;console.log(`PASS ${label}`)}else console.error(`FAIL ${label}`)}console.log(`\nUnified Composer F6B static gate: ${passed}/${checks.length}`);if(passed!==checks.length)process.exit(1)
