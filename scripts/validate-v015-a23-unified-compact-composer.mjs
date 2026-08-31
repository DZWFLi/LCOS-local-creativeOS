import fs from 'node:fs'
const read = (f) => fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const app = read('apps/web/src/App.tsx')
const host = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const conversation = read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const css = read('apps/web/src/reconstruction.css')
const pointer = read('apps/web/src/features/spatial/pointerInteractionLanguage.ts')

const checks = [
  ['Unified Composer declares compact local density', composer.includes('data-composer-density="compact"') && composer.includes('lcos-nearfield-composer')],
  ['Compact width stays below the old 470px default', css.includes('width:min(382px,calc(100vw - 96px))')],
  ['Prompt textarea autosizes only within the frozen bounded range', composer.includes('const minHeight = 34') && composer.includes('const maxHeight = 88') && composer.includes("textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'")],
  ['Prompt identity follows current target rather than only receiver identity', composer.includes('const targetLabel = selected.length === 1') && composer.includes('`对「${targetLabel}」说要做什么…`')],
  ['Explicit References stay compact and render only when they exist', composer.includes('references.length > 0 && <div className="lcos-reference-strip"') && !composer.includes('lcos-reference-empty')],
  ['Reference identity preserves order/thumbnail/remove controls', composer.includes('data-reference-order') && composer.includes('candidate.node.previewUrl') && composer.includes('onMoveReference') && composer.includes('onRemoveReference')],
  ['Explicit Reference affordance remains discoverable with Ctrl/Cmd accelerator language', composer.includes("'参考 · Ctrl/Cmd + 点击画布对象；不会改变当前选择'") && composer.includes('lcos-reference-pick')],
  ['Selection and Reference remain explicitly separate truths', composer.includes('当前选择的 ${selected.length} 项是直接处理对象，不会自动记入参考。') && pointer.includes('Ctrl/Cmd means this-run Reference') && pointer.includes('Shift-only')],
  ['Main Ctrl/Cmd Reference shortcut is live only while Compact Composer is open', canvas.includes('modifierEnabled?: boolean') && canvas.includes('referencePick.modifierEnabled && referenceModifierHeld') && app.includes('modifierEnabled: selectionComposerOpen')],
  ['Context/Workflow Ctrl/Cmd Reference shortcut is live only while local Composer exists', host.includes('command.referencePickActive || (agentNode && referenceModifierHeld)')],
  ['Receiver remains a compact execution target selector while provider stays advanced', composer.includes('lcos-receiver-select-compact') && composer.includes('交给哪段对话') && composer.includes('<span>执行器</span>')],
  ['Advanced parameters remain anchored disclosure rather than permanent first-screen controls', composer.includes('<details className="lcos-composer-advanced">') && css.includes('.lcos-composer-advanced-popover') && css.includes('bottom:29px')],
  ['Composer footer is compact and no disabled fake more-sources control remains', composer.includes('lcos-composer-footer-compact') && !composer.includes('更多来源') && !composer.includes('lcos-reference-add')],
  ['Ctrl/Cmd+Enter remains the explicit send shortcut', composer.includes("(event.metaKey || event.ctrlKey) && event.key === 'Enter'") && composer.includes('props.onSend()')],
  ['Main, Context/Workflow and Conversation all reuse UnifiedExecutionComposer shell', canvas.includes('<UnifiedExecutionComposer') && host.includes('<UnifiedExecutionComposer') && conversation.includes('<UnifiedExecutionComposer')],
  ['A23 does not smuggle Voice implementation into the compact-shell proposition', !composer.includes('MediaRecorder') && !composer.includes('SpeechRecognition') && !composer.includes('waveform')],
]
let passed=0
for (const [label, ok] of checks) { if(ok){passed++; console.log(`PASS ${label}`)} else console.error(`FAIL ${label}`) }
console.log(`A23 Unified Compact Composer: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
