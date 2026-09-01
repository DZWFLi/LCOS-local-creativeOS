import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootRequire = createRequire(resolve(root, 'package.json'))
const strict = process.argv.includes('--strict')
const jsonOnly = process.argv.includes('--json')

function resolveModule(name) {
  try { return rootRequire.resolve(name) } catch { return null }
}

function commandPath(name) {
  const command = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(command, [name], { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout.trim().split(/\r?\n/)[0] || null
}

function existingPath(value) {
  if (!value?.trim()) return null
  return existsSync(value) ? resolve(value) : null
}

function browserCandidates() {
  const values = [
    process.env.LCOS_CHROMIUM_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    commandPath('chromium'),
    commandPath('chromium-browser'),
    commandPath('google-chrome'),
    commandPath('msedge'),
    process.platform === 'win32' ? resolve(process.env['PROGRAMFILES'] ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe') : null,
    process.platform === 'win32' ? resolve(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe') : null,
  ]
  return [...new Set(values.filter(Boolean))].find((candidate) => existsSync(candidate)) ?? null
}

const modules = Object.fromEntries(['@playwright/test', 'vite', 'typescript', 'react', 'react-dom'].map((name) => [name, resolveModule(name)]))
const whisperBin = existingPath(process.env.LCOS_WHISPER_CPP_BIN)
const whisperModel = existingPath(process.env.LCOS_WHISPER_CPP_MODEL)
const ffmpeg = existingPath(process.env.LCOS_WHISPER_CPP_FFMPEG) ?? commandPath('ffmpeg')
const chromium = browserCandidates()
const nodeModules = existsSync(resolve(root, 'node_modules'))
const webDist = existsSync(resolve(root, 'apps/web/dist/index.html')) || existsSync(resolve(root, 'dist/index.html'))
const browserAutomationReady = Boolean(modules['@playwright/test'] && modules.vite && modules.react && modules['react-dom'] && chromium)
const realVoiceProviderReady = Boolean(whisperBin && whisperModel)

const report = {
  schemaVersion: 1,
  root,
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  nodeModules,
  webDist,
  modules,
  chromium,
  voice: {
    whisperBin,
    whisperModel,
    ffmpeg,
    realVoiceProviderReady,
  },
  readiness: {
    browserAutomationReady,
    automatedPhaseASmokeReady: browserAutomationReady,
    realVoiceProviderReady,
    phaseAAdmissionReady: browserAutomationReady && realVoiceProviderReady,
  },
  nextCommand: browserAutomationReady
    ? 'npm run test:e2e:phase-a'
    : 'npm ci && npm run preflight:phase-a -- --strict',
}

if (jsonOnly) console.log(JSON.stringify(report, null, 2))
else {
  console.log('LCOS v0.15 Phase A admission preflight')
  console.log(JSON.stringify(report, null, 2))
  if (!browserAutomationReady) console.log('\nBLOCKED: real App Browser smoke needs installed web dependencies + Chromium/Edge.')
  if (!realVoiceProviderReady) console.log('OPEN: real Voice admission still needs LCOS_WHISPER_CPP_BIN + LCOS_WHISPER_CPP_MODEL.')
}

if (strict && !report.readiness.phaseAAdmissionReady) process.exitCode = 2
