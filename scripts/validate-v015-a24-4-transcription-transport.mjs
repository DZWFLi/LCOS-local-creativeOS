import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const route = read('apps/local-core/src/routes/voice-transcription.ts')
const routeCode = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const server = read('apps/local-core/src/server.ts')
const client = read('apps/web/src/runtime/localCoreClient.ts')
const helper = read('apps/web/src/features/execution/voiceTranscriptionTransport.ts')
const contract = read('packages/contracts/src/voice-transcription.ts')
const contractIndex = read('packages/contracts/src/index.ts')
const service = read('apps/local-core/src/voice-transcription-service.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('A24-4 owns one narrow Local Core voice transcription route', route.includes("pathname !== '/runtime/voice/transcriptions'") && route.includes('handleVoiceTranscriptionRoute'))
check('Transport uses existing single-file multipart parser instead of base64 JSON audio', route.includes('parseMultipartImport') && !/base64|JSON\.stringify\([^)]*audio/i.test(routeCode))
check('Transport only admits the frozen hint/provider fields', route.includes("new Set(['durationMs', 'language', 'prompt', 'timestamps', 'providerId'])"))
check('Route requires audio MIME and non-empty bytes before provider invocation', route.includes("startsWith('audio/')") && route.includes('multipart.file.bytes.byteLength === 0'))
check('Route preserves duration/language/prompt/timestamps/provider selection through the provider seam', ['durationMs','language','prompt','timestamps','providerId'].every((token) => route.includes(token)))
check('Upload limits are explicit and bounded', server.includes('MAX_VOICE_TRANSCRIPTION_BODY_BYTES = 32 * 1024 * 1024') && route.includes('maxBodyBytes'))
check('Voice transcription gets a route-specific request budget without changing generic request timeout', server.includes('VOICE_TRANSCRIPTION_REQUEST_TIMEOUT_MS = 130_000') && server.includes("request.url?.startsWith('/runtime/voice/transcriptions')") && server.includes(': requestTimeoutMs'))
check('Route is registered behind Local Core bearer authorization', server.indexOf("if (apiToken !== undefined && !validBearerToken(request.headers.authorization, apiToken))") < server.lastIndexOf('handleVoiceTranscriptionRoute({'))
check('Default server transport delegates concrete provider composition to the explicit environment-gated Voice default owner', server.includes('createDefaultVoiceTranscriptionService()'))
check('Local Core server exposes an injectable transcription service for tests/native provider composition', server.includes('readonly voiceTranscriptionService?: VoiceTranscriptionService'))
check('Transport maps provider unavailable/failure/abort into stable HTTP/runtime errors', route.includes("error.code === 'provider-unavailable'") && route.includes("error.code === 'provider-failed'") && route.includes("error.code === 'aborted'"))
check('Shared wire result contains editable text evidence and optional language/segments/model/provider provenance', ['readonly text: string','readonly language?: string','readonly segments?: readonly VoiceTranscriptionSegmentTransportV1[]','readonly model?: string','readonly providerId: string'].every((token) => contract.includes(token)))
check('Shared voice transcription response is exported by contracts boundary', contractIndex.includes("from './voice-transcription.js'"))
check('Web transport builder uses FormData with one Blob/file body', helper.includes('new FormData()') && helper.includes("form.append('file', input.audio, 'voice-input')"))
check('Web transport builder carries optional duration/language/prompt/timestamps/provider hints', ['durationMs','language','prompt','timestamps','providerId'].every((token) => helper.includes(token)))
check('LocalCoreClient exposes one typed transcribeVoice call', client.includes('transcribeVoice(input: VoiceTranscriptionUploadInput') && client.includes("request('/runtime/voice/transcriptions'"))
check('Client transport allows slow local STT while remaining bounded', client.includes('timeoutMs: 120_000'))
check('Client does not manually set multipart content-type boundary', !/transcribeVoice[\s\S]{0,500}content-type/i.test(client))
check('A24-4 production transport contains no concrete Whisper/faster-whisper/sherpa engine', !/whisper|faster-whisper|sherpa|onnxruntime|CTranslate2|SpeechRecognition/i.test(routeCode + '\n' + helper))
check('A24-4 route does not own MediaRecorder/browser capture', !/MediaRecorder|getUserMedia|MediaStream/.test(routeCode))
check('A24-4 route cannot mutate Composer or Send/Run', !/UnifiedExecutionComposer|onPromptChange|setPrompt|onSend|onRun|submitRun|executeTask|RUN_TASK|SEND_PROMPT/.test(routeCode))
check('A24-3 provider seam remains transport-agnostic', !/FormData|multipart|IncomingMessage|ServerResponse|fetch\(/.test(service))
check('Unified Composer remains untouched by transport package', !/transcribeVoice|voiceTranscriptionTransport|runtime\/voice\/transcriptions/.test(composer))

const smoke = spawnSync(process.execPath, ['scripts/smoke-v015-a24-4-voice-transcription-transport.mjs'], { encoding: 'utf8' })
check('Multipart route + Web body builder runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('runtime smoke: PASS'))

const targetedTypecheck = spawnSync('tsc', [
  '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,DOM', '--strict', '--skipLibCheck',
  '--module', 'ESNext', '--moduleResolution', 'bundler',
  'apps/web/src/features/execution/voiceTranscriptionTransport.ts',
  'packages/contracts/src/voice-transcription.ts',
], { encoding: 'utf8' })
check('Browser multipart builder + shared wire contract pass targeted strict typecheck', targetedTypecheck.status === 0)

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed++; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
if (smoke.status !== 0) {
  if (smoke.stdout) console.error(smoke.stdout.trim())
  if (smoke.stderr) console.error(smoke.stderr.trim())
}
if (targetedTypecheck.status !== 0) {
  if (targetedTypecheck.stdout) console.error(targetedTypecheck.stdout.trim())
  if (targetedTypecheck.stderr) console.error(targetedTypecheck.stderr.trim())
}
console.log(`A24-4 Transcription Transport: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
