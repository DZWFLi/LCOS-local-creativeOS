import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const seam = read('apps/local-core/src/voice-transcription-service.ts')
const seamCode = seam.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const capture = read('apps/web/src/features/execution/voiceCapture.ts')
const lifecycle = read('apps/web/src/features/execution/voiceLifecycle.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const runtimeAdapter = read('apps/local-core/src/runtime-adapter.ts')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('A24-3 owns one Local Core transcription seam', seam.includes('export class VoiceTranscriptionService'))
check('Provider contract is explicit and replaceable', seam.includes('export interface VoiceTranscriptionProvider') && seam.includes('transcribe(request: VoiceTranscriptionRequestV1)'))
check('Input contract is audio bytes + MIME with optional timing', ['readonly bytes: Uint8Array','readonly mimeType: string','readonly durationMs?: number'].every((token) => seam.includes(token)))
check('Hints are provider-neutral and optional', ['readonly language?: string','readonly prompt?: string','readonly timestamps?: boolean'].every((token) => seam.includes(token)))
check('Normalized result can preserve provider/model/language/segments without owning GUI', ['readonly providerId: string','readonly language?: string','readonly segments?: readonly VoiceTranscriptionSegmentV1[]','readonly model?: string'].every((token) => seam.includes(token)))
check('Segment contract uses millisecond ranges and text', ['readonly startMs: number','readonly endMs: number','readonly text: string'].every((token) => seam.includes(token)))
check('Registry supports explicit provider registration and deterministic resolution', seam.includes('export class VoiceTranscriptionProviderRegistry') && seam.includes('right.score - left.score') && seam.includes('left.provider.id.localeCompare'))
check('Requested provider does not silently fall back to another provider', seam.includes('if (requestedProviderId !== undefined)') && seam.includes('return undefined'))
check('Provider selection does not reuse runtime Agent provider UI state', !/RuntimeProviderStatus|requestedProvider:\s*string|codex|workbuddy|surfaceExecution|onProviderChange/.test(seamCode))
check('Typed transcription errors separate invalid audio, unsupported audio, unavailable provider, provider failure and abort', ['invalid-audio','unsupported-audio','provider-unavailable','provider-failed','aborted'].every((code) => seam.includes(`'${code}'`)))
check('Empty audio and missing MIME fail before provider invocation', seam.includes('audio.bytes.byteLength === 0') && seam.includes("normalizedMimeType(audio.mimeType) === ''"))
check('Provider output segment geometry is validated', seam.includes('validateSegments') && seam.includes('segment.endMs < segment.startMs') && seam.includes('segment.startMs < previousEnd'))
check('Provider output is minimally normalized without rewriting semantic text', seam.includes("replace(/\\r\\n?/g, '\\n')") && !/trim\(\).*result\.text|result\.text\.trim/.test(seamCode))
check('A24-3 seam contains no concrete Whisper/faster-whisper/sherpa implementation', !/whisper|faster-whisper|sherpa|onnxruntime|CTranslate2|SpeechRecognition/i.test(seamCode))
check('A24-3 seam contains no browser capture mechanics', !/MediaRecorder|getUserMedia|MediaStream|Blob/.test(seamCode))
check('A24-3 seam cannot Send/Run/execute a task', !/onSend|onRun|submitRun|submitExecution|dispatchRuntimeRun|executeTask|RUN_TASK|SEND_PROMPT/.test(seamCode))
check('A24-3 does not mutate Composer prompt text yet', !/UnifiedExecutionComposer|onPromptChange|setPrompt|commandDraft/.test(seamCode))
check('A24-2 capture remains provider-agnostic', !/VoiceTranscription|transcrib|whisper|sherpa/i.test(capture))
check('A24-1 lifecycle remains provider-agnostic', !/VoiceTranscriptionProvider|whisper|sherpa|faster-whisper/i.test(lifecycle))
check('Unified Composer remains visually untouched by A24-3', !/VoiceTranscriptionProvider|transcription provider|whisper|sherpa/i.test(composer))
check('Existing RuntimeAdapterService remains separate from STT provider registry', !/VoiceTranscriptionProvider/.test(runtimeAdapter))

const smoke = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/smoke-v015-a24-3-voice-transcription.mjs'], { encoding: 'utf8' })
check('Provider-neutral transcription runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('runtime smoke: PASS'))

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed++; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
if (smoke.status !== 0) {
  if (smoke.stdout) console.error(smoke.stdout.trim())
  if (smoke.stderr) console.error(smoke.stderr.trim())
}
console.log(`A24-3 Transcription Provider Seam: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
