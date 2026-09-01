import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const provider = read('apps/local-core/src/voice-transcription-whisper-cpp-provider.ts')
const defaults = read('apps/local-core/src/voice-transcription-defaults.ts')
const server = read('apps/local-core/src/server.ts')
const service = read('apps/local-core/src/voice-transcription-service.ts')
const route = read('apps/local-core/src/routes/voice-transcription.ts')
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const index = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const ledger = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')
const census = read('docs/v015/convergence/A24_5_CONCRETE_STT_PROVIDER_DECISION_20260901.md')
const closeout = read('docs/v015/convergence/A24_5_WHISPER_CPP_PROVIDER_CLOSEOUT_20260901.md')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('Concrete provider is isolated behind A24-3 VoiceTranscriptionProvider', provider.includes('implements VoiceTranscriptionProvider') && provider.includes("readonly id = 'whisper.cpp-cli'"))
check('Provider accepts audio MIME through the provider-neutral seam', provider.includes("mime.startsWith('audio/')") && provider.includes('VoiceTranscriptionRequestV1'))
check('Browser capture formats are converted through FFmpeg to 16k mono PCM WAV before whisper.cpp', provider.includes("'-ar', '16000'") && provider.includes("'-ac', '1'") && provider.includes("'pcm_s16le'"))
check('whisper.cpp invocation uses JSON output instead of scraping human console text', provider.includes("'-oj'") && provider.includes("'-of'") && provider.includes('JSON.parse'))
check('Language hint maps to whisper language while preserving auto-detect fallback', provider.includes("args.push('-l', language ?? 'auto')"))
check('Prompt hint maps to whisper prompt without shell interpolation', provider.includes("args.push('--prompt', prompt)") && provider.includes('spawn(command, [...args]'))
check('Optional timestamps normalize whisper offsets into LCOS millisecond segments', provider.includes('startMs: from') && provider.includes('endMs: to') && provider.includes("request.hints?.timestamps === true"))
check('Model provenance remains evidence rather than product truth', provider.includes('model: modelLabel') && provider.includes('safeModelLabel'))
check('Abort kills the child process and returns typed aborted evidence', provider.includes("child.kill('SIGTERM')") && provider.includes("'aborted'"))
check('Provider process has bounded runtime and bounded captured diagnostics', provider.includes('DEFAULT_PROCESS_TIMEOUT_MS') && provider.includes('MAX_CAPTURED_PROCESS_OUTPUT_BYTES'))
check('Temporary audio and JSON material is deleted deterministically', provider.includes("mkdtemp(join(tmpdir(), 'lcos-whisper-cpp-'))") && provider.includes("rm(temp, { recursive: true, force: true })"))
check('Missing whisper binary or model is provider-unavailable, not fake success', provider.includes('whisper.cpp executable is missing') && provider.includes('whisper.cpp model is missing'))
check('Default composition only registers whisper.cpp when exact local binary+model assets exist', defaults.includes('createWhisperCppProviderFromEnvironment') && provider.includes('!existsSync(binaryPath)') && provider.includes('!existsSync(modelPath)'))
check('Server uses environment-gated default composition while retaining injected service override', server.includes('options.voiceTranscriptionService ?? createDefaultVoiceTranscriptionService()') && server.includes('readonly voiceTranscriptionService?: VoiceTranscriptionService'))
check('Concrete provider does not change the A24-3 canonical seam name or contract', service.includes('export interface VoiceTranscriptionProvider') && !/WhisperProviderRegistry|WhisperTranscriptionService/.test(service))
check('Concrete provider remains Local Core only and does not enter Web Composer code', !/whisper\.cpp|LCOS_WHISPER_CPP|ffmpeg/i.test(composer))
check('Concrete provider contains no Send/Run execution semantics', !/submitRun|executeTask|onSend|onRun|SEND_PROMPT|RUN_TASK/.test(provider))
check('Transport route stays provider-neutral and contains no whisper CLI knowledge', !/whisper\.cpp|ffmpeg|LCOS_WHISPER_CPP/.test(route))
check('No model weights or whisper binary are vendored into this patch', !fs.existsSync('apps/local-core/vendor/whisper.cpp') && !fs.existsSync('models/ggml-base.bin'))
check('Donor decision records whisper.cpp, faster-whisper and sherpa-onnx packaging tradeoffs', ['whisper.cpp','faster-whisper','sherpa-onnx','Windows x64','FFmpeg','MIT','Apache-2.0'].every((token) => census.includes(token)))
check('Closeout records concrete provider PASS without claiming real model/browser acceptance', closeout.includes('SOURCE/RUNTIME PASS') && closeout.includes('REAL MODEL E2E = OPEN'))
check('Construction Context Index points A24-5 at the exact provider/decision/validator files', index.includes('A24-5 pointer · Concrete STT Provider') && index.includes('A24_5_WHISPER_CPP_PROVIDER_CLOSEOUT_20260901.md'))
check('Mandatory Context records concrete provider as packaging/runtime adapter, not Voice truth', mandatory.includes('A24-5 · Concrete STT Provider') && mandatory.includes('whisper.cpp-cli'))
check('GUI responsibility matrix preserves concrete provider PASS through later Voice progress', matrix.includes('concrete provider PASS') && (matrix.includes('orchestration/GUI open') || matrix.includes('A24-6 orchestration PASS')))
check('Night rolling ledger advances next proposition after A24-5', ledger.includes('A24-5 Concrete STT Provider') && ledger.includes('A24-6 Voice Orchestration'))

const smoke = spawnSync(process.execPath, ['scripts/smoke-v015-a24-5-whisper-cpp-provider.mjs'], { encoding: 'utf8' })
check('Concrete whisper.cpp adapter subprocess/runtime smoke passes', smoke.status === 0 && smoke.stdout.includes('runtime smoke: PASS'))

const syntax = spawnSync(process.execPath, ['--experimental-strip-types', '-e', "const fs=require('node:fs'); const {stripTypeScriptTypes}=require('node:module'); stripTypeScriptTypes(fs.readFileSync('apps/local-core/src/voice-transcription-whisper-cpp-provider.ts','utf8'),{mode:'transform'}); console.log('PASS')"], { encoding: 'utf8' })
check('Concrete provider source passes Node TypeScript stripping syntax transform', syntax.status === 0 && syntax.stdout.includes('PASS'))

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
console.log(`A24-5 Concrete STT Provider: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
