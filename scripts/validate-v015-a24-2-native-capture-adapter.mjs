import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const capture = read('apps/web/src/features/execution/voiceCapture.ts')
const captureCode = capture.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const lifecycle = read('apps/web/src/features/execution/voiceLifecycle.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('A24-2 owns one dedicated native capture module', capture.includes('export class NativeVoiceCaptureAdapter'))
check('Capture seam exposes a replaceable adapter contract', capture.includes('export interface VoiceCaptureAdapter') && capture.includes('export interface VoiceCaptureEnvironment'))
check('Native capture explicitly requests microphone audio without video', capture.includes("getUserMedia({ audio: true, video: false })"))
check('Native capture uses MediaRecorder through the environment seam', capture.includes('createMediaRecorder') && capture.includes('globalThis.MediaRecorder'))
check('Capture prefers mature compressed audio MIME candidates with fallback', ['audio/webm;codecs=opus','audio/webm','audio/mp4'].every((mime) => capture.includes(`'${mime}'`)))
check('Stop returns Blob + MIME + timing metadata', ['readonly blob: Blob','readonly mimeType: string','readonly durationMs: number','new Blob(session.chunks'].every((token) => capture.includes(token)))
check('Repeated start is rejected by typed invalid-state error', capture.includes("'invalid-state'") && capture.includes('A microphone capture session is already active.'))
check('Stop without an active session is rejected', capture.includes('No microphone capture session is active.'))
check('Cancel is idempotent when there is no active session', capture.includes('if (session === null) return'))
check('Cancel discards captured chunks instead of returning a transcript/result', capture.includes('session.chunks.length = 0'))
check('All MediaStream tracks are explicitly stopped during cleanup', capture.includes('stream.getTracks()') && capture.includes('track.stop()'))
check('Recorder callbacks are detached during cleanup', ['session.recorder.ondataavailable = null','session.recorder.onstop = null','session.recorder.onerror = null'].every((token) => capture.includes(token)))
check('Permission denial has a typed capture error', capture.includes("'permission-denied'") && capture.includes("name === 'NotAllowedError'"))
check('Missing microphone has a typed capture error', capture.includes("'device-not-found'") && capture.includes("name === 'NotFoundError'"))
check('Unavailable/busy microphone has a typed capture error', capture.includes("'device-unavailable'") && capture.includes("name === 'NotReadableError'"))
check('Async MediaRecorder failure is observable and cleans resources', capture.includes('onError(listener: VoiceCaptureErrorListener)') && capture.includes("'recorder-failed'") && capture.includes('this.cleanup(session!)'))
check('Capture adapter does not import or own the XState lifecycle', !/voiceLifecycle|xstate/i.test(captureCode))
check('Capture adapter contains no STT/transcription provider implementation', !/SpeechRecognition|whisper|transcrib(?:e|ing|tion)|\/api\/.*speech|sttProvider/i.test(captureCode))
check('Capture adapter contains no waveform/AudioContext visualization path', !/waveform|AudioContext|AnalyserNode|getByteTimeDomainData/i.test(captureCode))
check('Capture adapter cannot Send/Run/execute a task', !/onSend|onRun|submitRun|submitExecution|executeTask|RUN_TASK|SEND_PROMPT/.test(captureCode))
check('A24-2 does not wire capture into Composer yet', !/voiceCapture|NativeVoiceCaptureAdapter|MediaRecorder|getUserMedia/.test(composer))
check('A24-1 lifecycle still contains no browser capture mechanics', !/MediaRecorder|getUserMedia|Blob|mimeType/.test(lifecycle))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a24-2-voice-capture.mjs'], { encoding: 'utf8' })
check('Native capture runtime smoke passes with fake browser media primitives', smoke.status === 0 && smoke.stdout.includes('runtime smoke: PASS'))

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed++; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
if (smoke.status !== 0) {
  if (smoke.stdout) console.error(smoke.stdout.trim())
  if (smoke.stderr) console.error(smoke.stderr.trim())
}
console.log(`A24-2 Native Capture Adapter: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
