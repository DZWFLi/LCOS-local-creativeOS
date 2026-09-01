import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const spec = read('tests/e2e/v015-phase-a-admission.spec.ts')
const config = read('playwright.phase-a.config.ts')
const preflight = read('scripts/phase-a-admission-preflight.mjs')
const status = read('docs/v015/convergence/PHASE_A_HUMAN_PRODUCT_SMOKE_ADMISSION_STATUS_20260901.md')
const pkg = JSON.parse(read('package.json'))

const checks = [
  ['dedicated npm e2e entry exists', pkg.scripts?.['test:e2e:phase-a']?.includes('playwright.phase-a.config.ts')],
  ['preflight entry exists', pkg.scripts?.['preflight:phase-a']?.includes('phase-a-admission-preflight.mjs')],
  ['phase-a config isolates admission spec', config.includes("testMatch: 'v015-phase-a-admission.spec.ts'")],
  ['DPR 100 evidence project', config.includes("name: 'chromium-dpr100'") && config.includes('deviceScaleFactor: 1 }')],
  ['DPR 125 evidence project', config.includes("name: 'chromium-dpr125'") && config.includes('deviceScaleFactor: 1.25')],
  ['DPR 150 evidence project', config.includes("name: 'chromium-dpr150'") && config.includes('deviceScaleFactor: 1.5')],
  ['fake media only belongs to automated browser fixture', config.includes('--use-fake-device-for-media-stream') && spec.includes('installFakeVoiceBrowser')],
  ['Search top-slot smoke exists', spec.includes("data-spatial-index-owner', 'search") && spec.includes('project-tools-dialog')],
  ['Search to Focus handoff smoke exists', spec.includes("data-spatial-index-owner', 'focus") && spec.includes('centered-search-control')],
  ['legacy Focus list stays retired', spec.includes('.project-focus-navigator')],
  ['Color Pin authoring smoke exists', spec.includes('object-color-pin') && spec.includes('color-pin-authoring-popover')],
  ['Color Pin local dots smoke exists', spec.includes('color-pin-local-dots-')],
  ['Color Pin single-member Focus handoff exists', spec.includes("data-spatial-index-owner', 'color-pin") && spec.includes('colorIndexItem.click()')],
  ['Voice Recording morphology smoke exists', spec.includes("data-voice-state', 'recording")],
  ['Voice transcription returns editable prompt smoke exists', spec.includes('浏览器语音验收文本') && spec.includes("data-voice-state', 'editable")],
  ['Voice Send yields while recording', spec.includes(".lcos-composer-send')).toHaveCount(0)".replace("'", "'"))],
  ['occupied region fixture uses canonical occupant protocol', spec.includes("data-spatial-viewport-occupant', 'right")],
  ['occupied region does not move Camera', spec.includes('expect(await cameraSnapshot(page)).toEqual(beforeCamera)')],
  ['zoom matrix covers 25/35/60/100/150', spec.includes('[0.25, 0.35, 0.6, 1, 1.5]')],
  ['visual evidence attachments are emitted', spec.includes('test.info().attach')],
  ['preflight checks node_modules', preflight.includes("resolve(root, 'node_modules')")],
  ['preflight checks browser dependencies', preflight.includes("'@playwright/test'") && preflight.includes("'vite'") && preflight.includes("'react-dom'")],
  ['preflight checks real whisper assets', preflight.includes('LCOS_WHISPER_CPP_BIN') && preflight.includes('LCOS_WHISPER_CPP_MODEL')],
  ['status does not grant admission', status.includes('PHASE A ADMISSION = NOT GRANTED')],
  ['status separates automated fake-media evidence from real Voice evidence', status.includes('fake-media Browser smoke ≠ real microphone / whisper.cpp evidence')],
  ['B0 stays gated', status.includes('Do not begin B0')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`Phase A Human Smoke Pack: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exitCode = 1
