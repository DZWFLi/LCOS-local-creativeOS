import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const helper = read('apps/web/src/features/execution/voiceComposerInput.ts')
const orchestration = read('apps/web/src/features/execution/voiceOrchestration.ts')
const css = read('apps/web/src/reconstruction.css')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const sceneHost = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const conversation = read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const ledger = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')
const closeout = read('docs/v015/convergence/A24_7_COMPOSER_VOICE_GUI_CLOSEOUT_20260901.md')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('Composer consumes the admitted A24-6 orchestrator rather than a second lifecycle machine', composer.includes('DefaultVoiceOrchestrator') && composer.includes('createLocalCoreVoiceTranscribePort') && !composer.includes('voiceLifecycleMachine'))
check('Composer gets Local Core through the existing optional client context', composer.includes('useLocalCoreClientOrNull()'))
check('Composer does not touch browser microphone/capture APIs directly', !/getUserMedia|MediaRecorder|navigator\.mediaDevices|SpeechRecognition/.test(composer))
check('Voice trigger is part of the existing compact Composer footer', composer.includes('className="lcos-voice-trigger"') && composer.indexOf('lcos-voice-trigger') > composer.indexOf('lcos-composer-footer-compact'))
check('Voice trigger fails closed when Local Core is absent or execution is busy', composer.includes('const voiceAvailable = localCoreClient !== null && !props.busy') && composer.includes('disabled={!voiceAvailable}'))
check('Starting Voice retires active Reference Pick rather than stacking two input modes', composer.includes('if (props.referencePickActive) props.onFinishReferencePick()'))
check('Requesting/Recording/Transcribing/error states morph the input region in-place', composer.includes('lcos-voice-input-stage') && composer.includes('voiceMode ? <div') && composer.includes('正在连接麦克风') && composer.includes('正在听你说') && composer.includes('正在转成文字'))
check('Recording owns compact Cancel and Stop controls', composer.includes('取消语音输入') && composer.includes('停止并转成文字') && composer.includes('<Square size={11}/>'))
check('Transcribing has no Send action inside the Voice state block', (() => { const start = composer.indexOf('{voiceMode ? <div'); const end = composer.indexOf('</div> : <>', start); return start >= 0 && end > start && !composer.slice(start, end).includes('props.onSend') })())
check('Unrelated footer controls yield while transient Voice state is active', composer.includes('{voiceMode ? <div') && composer.indexOf('lcos-composer-footer-compact') > composer.indexOf('</div> : <>'))
check('Successful transcript uses existing prompt mutation callback only', composer.includes('appendVoiceTranscript(promptRef.current, transcript.text)') && composer.includes('onPromptChangeRef.current(nextPrompt)'))
check('Transcript handoff never calls Send/Run', (() => { const start = composer.indexOf('orchestrator.onTranscript'); const end = composer.indexOf('return () =>', start); return start >= 0 && end > start && !/onSend|Run|execute/.test(composer.slice(start, end)) })())
check('Existing typed prompt is preserved when Voice transcript arrives', helper.includes('if (!prompt.trim()) return cleanTranscript') && helper.includes("/\\s$/.test(prompt) ? '' : ' '"))
check('Editable/idle states restore the ordinary textarea', helper.includes("state !== 'idle' && state !== 'editable'") && composer.includes('data-testid="selection-composer-input"'))
check('Voice error states expose Retry plus Return-to-text without a large panel', composer.includes('retryVoice') && composer.includes('resetVoice') && composer.includes('返回文字输入') && !/VoicePanel|voice-panel|createPortal/.test(composer))
check('Esc first cancels active Voice while preserving Composer', composer.includes("if (voiceState !== 'idle' && voiceState !== 'editable')") && composer.includes('voiceOrchestratorRef.current?.cancel()') && composer.indexOf('voiceOrchestratorRef.current?.cancel()') < composer.indexOf('onCloseRef.current()'))
check('Outside press cancels Voice before dismissTop pops overlay ownership', (() => { const start = composer.indexOf('const onOutsidePointerDown'); const end = composer.indexOf("window.addEventListener('pointerdown'", start); const block = composer.slice(start, end); return block.indexOf('voiceOrchestratorRef.current?.cancel()') >= 0 && block.indexOf('voiceOrchestratorRef.current?.cancel()') < block.indexOf('dismissTop()') })())
check('Unmount disposes orchestrator so microphone/transcription resources cannot leak', composer.includes('void orchestrator.dispose()'))
check('Composer shell width remains the A23 382px compact owner', css.includes('width:min(382px,calc(100vw - 96px)) !important'))
check('Recording waveform stays short rather than expanding into a Voice panel', css.includes('.lcos-voice-waveform') && css.includes('width:86px'))
check('Voice state uses compact local controls', css.includes('.lcos-voice-action { width:26px; padding:0; }') && css.includes('height:24px'))
check('Reduced-motion disables Voice waveform and transcribing spin', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.lcos-voice-waveform i') && css.includes('animation:none'))
check('A24-6 orchestrator still has no execution owner', !/onSend|submitRun|executeTask|autoSend/.test(orchestration))
check('Main continues to reuse UnifiedExecutionComposer', projectCanvas.includes('<UnifiedExecutionComposer'))
check('Context/Workflow scene host continues to reuse UnifiedExecutionComposer', sceneHost.includes('<UnifiedExecutionComposer'))
check('Glyth/Conversation surface continues to reuse UnifiedExecutionComposer', conversation.includes('<UnifiedExecutionComposer'))
check('No per-surface Voice component was introduced', !/VoicePanel|VoiceComposer|VoiceRecorder/.test(projectCanvas + sceneHost + conversation))
check('Closeout keeps Browser/Human acceptance open', closeout.includes('SOURCE/STATIC PASS · BROWSER/HUMAN OPEN') && closeout.includes('A24-8 Voice Browser/Human Acceptance + A24 Closeout'))
check('Context Index points at A24-7 source/closeout/validator', index.includes('A24-7 pointer · Composer Voice GUI') && index.includes('A24_7_COMPOSER_VOICE_GUI_CLOSEOUT_20260901.md'))
check('Mandatory Context records the no-second-state-machine GUI owner split', mandatory.includes('A24-7 · Unified Composer Voice GUI') && mandatory.includes('MUST NOT') && mandatory.includes('voiceLifecycleMachine'))
check('Responsibility Matrix advances GUI source/static but preserves Browser/Human debt', matrix.includes('A24-7 GUI source/static PASS') && (matrix.includes('Browser/Human open') || matrix.includes('A24-8 Browser/Human ENVIRONMENT_BLOCKED / HUMAN OPEN')))
check('Night rolling ledger advances A24-8 while queueing A25 separately', ledger.includes('A24-7 Composer Voice GUI') && ledger.includes('A24-8 Voice Browser/Human Acceptance') && ledger.includes('A25 Active Spatial Viewport / Centered Index'))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a24-7-composer-voice-gui.mjs'], { encoding: 'utf8' })
check('Composer Voice presentation helper runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('presentation smoke: PASS'))

const parse = spawnSync('tsc', ['--noEmit', '--jsx', 'preserve', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--skipLibCheck', '--allowImportingTsExtensions', '--noResolve', 'apps/web/src/features/execution/UnifiedExecutionComposer.tsx'], { encoding: 'utf8' })
const parseOutput = `${parse.stdout}\n${parse.stderr}`
check('Composer TSX has no parser diagnostics in the dependency-less environment', !/error TS1\d{3}:|error TS11\d{2}:/.test(parseOutput))

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
if (smoke.status !== 0) {
  if (smoke.stdout) console.error(smoke.stdout.trim())
  if (smoke.stderr) console.error(smoke.stderr.trim())
}
if (parseOutput.match(/error TS1\d{3}:|error TS11\d{2}:/)) console.error(parseOutput.trim())
console.log(`A24-7 Composer Voice GUI: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
