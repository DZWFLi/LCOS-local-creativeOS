import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const orchestration = read('apps/web/src/features/execution/voiceOrchestration.ts')
const lifecycle = read('apps/web/src/features/execution/voiceLifecycle.ts')
const capture = read('apps/web/src/features/execution/voiceCapture.ts')
const transport = read('apps/web/src/runtime/localCoreClient.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const ledger = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')
const closeout = read('docs/v015/convergence/A24_6_VOICE_ORCHESTRATION_CLOSEOUT_20260901.md')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('Orchestration uses the admitted vendored XState actor runtime', orchestration.includes("import { createActor } from '../../vendor/xstate-5.32.6/src/index.ts'"))
check('Orchestration consumes the real A24-1 lifecycle machine rather than redefining states', orchestration.includes("voiceLifecycleMachine") && !orchestration.includes('createMachine({'))
check('Orchestration consumes A24-2 VoiceCaptureAdapter rather than browser media APIs directly', orchestration.includes('VoiceCaptureAdapter') && orchestration.includes('NativeVoiceCaptureAdapter') && !/getUserMedia|MediaRecorder/.test(orchestration))
check('Orchestration consumes A24-4 LocalCoreClient transcription transport through a narrow port', orchestration.includes("Pick<LocalCoreClient, 'transcribeVoice'>") && orchestration.includes('createLocalCoreVoiceTranscribePort'))
check('Happy path maps START_RECORDING and PERMISSION_GRANTED around capture start', orchestration.includes("{ type: 'START_RECORDING' }") && orchestration.includes("{ type: 'PERMISSION_GRANTED' }"))
check('Stop waits for capture result before entering Transcribing', orchestration.indexOf('capture = await this.capture.stop()') < orchestration.indexOf("this.actor.send({ type: 'STOP_RECORDING' })"))
check('Transcription success produces editable lifecycle handoff', orchestration.includes("{ type: 'TRANSCRIPTION_SUCCEEDED' }") && orchestration.includes('this.transcript = transcript'))
check('Transcript is exposed through returned result / observer rather than Composer mutation', orchestration.includes('onTranscript(listener') && orchestration.includes('VoiceTranscriptListener') && !/onPromptChange|setPrompt|promptState/.test(orchestration))
check('Cancel invalidates pending permission work and cleans late capture', orchestration.includes('operationVersion') && orchestration.includes('if (!this.isCurrent(version))') && orchestration.includes('await this.capture.cancel()'))
check('Transcription cancel owns one AbortController and aborts transport', orchestration.includes('private transcriptionAbort: AbortController | null') && orchestration.includes('this.transcriptionAbort?.abort()'))
check('Recording cancel cannot reach transcription', orchestration.includes("state === 'requestingPermission' || state === 'recording'") && orchestration.includes("this.actor.send({ type: 'CANCEL' })"))
check('Permission denied and capture failures map to distinct lifecycle evidence', orchestration.includes("'PERMISSION_DENIED'") && orchestration.includes("'CAPTURE_FAILED'"))
check('Transcription failure maps to the A24-1 transcription error state', orchestration.includes("{ type: 'TRANSCRIPTION_FAILED' }"))
check('Capture retry starts a new capture attempt', orchestration.includes("state === 'permissionDenied' || state === 'captureError'") && orchestration.includes("this.actor.send({ type: 'RETRY' })"))
check('Transcription retry reuses the retained transient capture without recording again', orchestration.includes("state === 'transcriptionError' && this.lastCapture !== null") && orchestration.includes('this.transcribeCapture(version, this.lastCapture, this.lastHints)'))
check('Cancel/discard clears transcript and retained capture state', orchestration.includes('this.lastCapture = null') && orchestration.includes('this.transcript = null'))
check('Observer failures cannot mutate Voice truth', orchestration.includes('transcript observers cannot change Voice truth') && orchestration.includes('presentation observers cannot break orchestration'))
check('Dispose aborts transcription, cancels capture and stops actor', orchestration.includes('async dispose()') && orchestration.includes('this.abortTranscription()') && orchestration.includes('this.actor.stop()'))
check('Orchestration defines no execution/Send/Run owner', !/onSend|submitRun|executeTask|SEND_PROMPT|RUN_TASK|sendRun|autoSend/.test(orchestration))
check('A24-1 machine still contains no Send/Run transition', !/\{ readonly type: '(SEND|RUN|EXECUTE)[^']*' \}/.test(lifecycle) && !/(SEND|RUN|EXECUTE)[A-Z_]*\s*:/.test(lifecycle))
check('A24-2 capture still has no transcription/Composer ownership', !/transcribeVoice|onPromptChange|UnifiedExecutionComposer/.test(capture))
check('Local Core transport still has no Voice lifecycle ownership', !/START_RECORDING|PERMISSION_GRANTED|voiceLifecycleMachine/.test(transport))
check('Unified Composer may consume the orchestrator but never owns the Voice lifecycle machine directly', !/voiceLifecycleMachine|createMachine\(\{/.test(composer))
check('Closeout states orchestration PASS while GUI/Human remains open', closeout.includes('SOURCE/RUNTIME PASS · GUI/HUMAN OPEN') && closeout.includes('A24-7 Composer Voice GUI    = NEXT'))
check('Construction Context Index points at A24-6 exact source/closeout/validator', index.includes('A24-6 pointer · Voice Orchestration') && index.includes('A24_6_VOICE_ORCHESTRATION_CLOSEOUT_20260901.md'))
check('Mandatory Context records A24-6 as orchestration only', mandatory.includes('A24-6 · Voice Orchestration') && mandatory.includes('operation ordering / cancellation / retry / transcript handoff'))
check('GUI responsibility matrix preserves A24-6 orchestration PASS through later GUI progress', matrix.includes('A24-6 orchestration PASS') && (matrix.includes('GUI/Human open') || matrix.includes('A24-7 GUI source/static PASS')))
check('Night rolling ledger advances A24-7 after A24-6', ledger.includes('A24-6 Voice Orchestration') && ledger.includes('A24-7 Composer Voice GUI'))

const smoke = spawnSync(process.execPath, ['scripts/smoke-v015-a24-6-voice-orchestration.mjs'], { encoding: 'utf8' })
check('Voice orchestration concurrency/cancel/retry runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('runtime smoke: PASS'))

const syntax = spawnSync(process.execPath, ['--experimental-strip-types', '-e', "const fs=require('node:fs'); const {stripTypeScriptTypes}=require('node:module'); stripTypeScriptTypes(fs.readFileSync('apps/web/src/features/execution/voiceOrchestration.ts','utf8'),{mode:'transform'}); console.log('PASS')"], { encoding: 'utf8' })
check('Voice orchestration source passes Node TypeScript syntax transform', syntax.status === 0 && syntax.stdout.includes('PASS'))

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
if (smoke.status !== 0) {
  if (smoke.stdout) console.error(smoke.stdout.trim())
  if (smoke.stderr) console.error(smoke.stderr.trim())
}
if (syntax.status !== 0) {
  if (syntax.stdout) console.error(syntax.stdout.trim())
  if (syntax.stderr) console.error(syntax.stderr.trim())
}
console.log(`A24-6 Voice Orchestration: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
