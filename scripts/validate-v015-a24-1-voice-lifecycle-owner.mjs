import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const lifecycle = read('apps/web/src/features/execution/voiceLifecycle.ts')
const vendorRoot = 'apps/web/src/vendor/xstate-5.32.6'
const vendorRecord = read(`${vendorRoot}/LCOS_VENDORING.md`)
const vendorPackage = JSON.parse(read(`${vendorRoot}/package.json`))
const upstreamPackage = JSON.parse(read(`${vendorRoot}/UPSTREAM_PACKAGE.json`))
const tsconfig = JSON.parse(read('apps/web/tsconfig.json'))
const composer = read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')

const checks = []
const check = (label, ok) => checks.push([label, Boolean(ok)])

check('A24-1 owns one dedicated Voice lifecycle module', lifecycle.includes('export const voiceLifecycleMachine'))
check('Voice lifecycle uses the vendored XState setup() primitive', lifecycle.includes("from '../../vendor/xstate-5.32.6/src/index.ts'") && lifecycle.includes('setup({'))
check('Vendored XState upstream version is exactly 5.32.6', upstreamPackage.name === 'xstate' && upstreamPackage.version === '5.32.6')
check('Vendored XState source remains MIT and records the reviewed donor commit', upstreamPackage.license === 'MIT' && vendorPackage.license === 'MIT' && vendorRecord.includes('21872cdc93a3baddbcf43f1d83553991d39f28ab'))
check('Local package boundary exposes the upstream #is-development condition', vendorPackage.imports?.['#is-development']?.default === './src/false.ts')
check('Web TypeScript allows the upstream explicit .ts import form without rewriting donor source', tsconfig.compilerOptions?.allowImportingTsExtensions === true)
check('Voice state contract includes idle/requestingPermission/recording/transcribing/editable', ['idle','requestingPermission','recording','transcribing','editable'].every((state) => lifecycle.includes(`'${state}'`)))
check('Voice error contract includes permissionDenied/captureError/transcriptionError', ['permissionDenied','captureError','transcriptionError'].every((state) => lifecycle.includes(`'${state}'`)))
check('Idle can only begin Voice through START_RECORDING → requestingPermission', lifecycle.includes("START_RECORDING: 'requestingPermission'"))
check('Permission success/failure branches are explicit', lifecycle.includes("PERMISSION_GRANTED: 'recording'") && lifecycle.includes("PERMISSION_DENIED: 'permissionDenied'"))
check('Recording stops into transcription and can cancel without execution', lifecycle.includes("STOP_RECORDING: 'transcribing'") && lifecycle.includes("CANCEL: 'idle'"))
check('Transcription success becomes editable text state', lifecycle.includes("TRANSCRIPTION_SUCCEEDED: 'editable'"))
check('Transcription failure owns an explicit retry state', lifecycle.includes("TRANSCRIPTION_FAILED: 'transcriptionError'") && lifecycle.includes("transcriptionError:") && lifecycle.includes("RETRY: 'transcribing'"))
check('Permission/capture errors own explicit retry/reset paths', lifecycle.includes("permissionDenied:") && lifecycle.includes("captureError:") && lifecycle.includes("RETRY: 'requestingPermission'"))
check('Voice machine cannot auto-send or execute', !/[\"'](?:SEND|RUN|EXECUTE|EXECUTION)[\"']|onSend|onRun|submitRun|submitExecution/.test(lifecycle))
check('A24-1 does not smuggle capture/STT/GUI into the lifecycle proposition', !/MediaRecorder|getUserMedia|SpeechRecognition|waveform|Blob|transcript text|onPromptChange/i.test(lifecycle))
check('Unified Composer never becomes the Voice lifecycle/capture owner; later A24 presentation is allowed', !/voiceLifecycleMachine|START_RECORDING|MediaRecorder|getUserMedia/.test(composer))

const manifestLines = read(`${vendorRoot}/UPSTREAM_SHA256SUMS`).trim().split('\n').filter(Boolean)
let hashesOk = manifestLines.length >= 70
for (const line of manifestLines) {
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
  if (!match) { hashesOk = false; break }
  const file = path.join(vendorRoot, match[2])
  if (!fs.existsSync(file)) { hashesOk = false; break }
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  if (digest !== match[1]) { hashesOk = false; break }
}
check('Vendored upstream file hash manifest is internally intact', hashesOk)

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed++; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A24-1 Voice Lifecycle Owner: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
