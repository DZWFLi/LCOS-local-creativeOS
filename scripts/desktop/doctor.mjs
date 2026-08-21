#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const requireInstalled = process.argv.includes('--ready')
const releaseMode = process.argv.includes('--release')
let failed = false

function ok(label, detail = '') { console.log(`✓ ${label}${detail ? ` · ${detail}` : ''}`) }
function warn(label, detail = '') { console.warn(`! ${label}${detail ? ` · ${detail}` : ''}`) }
function fail(label, detail = '') { console.error(`✗ ${label}${detail ? ` · ${detail}` : ''}`); failed = true }
function checkFile(label, path) { existsSync(path) ? ok(label, path) : fail(label, path) }

console.log(`LCOS PASS8 Desktop doctor · ${process.platform} · node ${process.version}`)
checkFile('Desktop package', join(root, 'apps', 'desktop', 'package.json'))
checkFile('Electron main', join(root, 'apps', 'desktop', 'src', 'main.mjs'))
checkFile('Electron preload', join(root, 'apps', 'desktop', 'src', 'preload.mjs'))
checkFile('Runtime supervisor', join(root, 'apps', 'desktop', 'src', 'runtime-supervisor.mjs'))
checkFile('Capture Float UI', join(root, 'apps', 'web', 'src', 'features', 'capture', 'CaptureFloatApp.tsx'))
checkFile('Capture Space UI', join(root, 'apps', 'web', 'src', 'features', 'capture', 'CaptureSpace.tsx'))
checkFile('Windows icon', join(root, 'apps', 'desktop', 'assets', 'lcos.ico'))

let lockHasDesktop = false
try {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  lockHasDesktop = Boolean(lock?.packages?.['apps/desktop'])
} catch {}
if (lockHasDesktop) ok('package-lock includes Desktop workspace')
else if (requireInstalled) fail('package-lock is still pre-Desktop', 'run `npm install` once from the repo root')
else warn('package-lock is pre-Desktop', 'expected in the source snapshot; `npm run baseline:bootstrap` refreshes it')

const forge = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-forge.cmd' : 'electron-forge')
if (existsSync(forge)) ok('Electron Forge installed')
else if (requireInstalled) fail('Electron Forge missing', 'bootstrap dependencies first')
else warn('node_modules not present', 'source packages intentionally exclude dependencies')

function portFree(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolvePromise(false) })
    socket.once('error', () => resolvePromise(true))
    socket.setTimeout(250, () => { socket.destroy(); resolvePromise(true) })
  })
}
for (const port of [43121, 43122]) {
  if (await portFree(port)) ok(`Runtime port ${port} free`)
  else warn(`Runtime port ${port} occupied`, 'stop an old LCOS/dev stack before Desktop QA')
}

if (process.platform === 'win32') {
  const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON || 'python.exe'
  const py = spawnSync(python, ['--version'], { encoding: 'utf8', windowsHide: true })
  if ((py.status ?? 1) === 0) ok('Windows Python available', (py.stdout || py.stderr || '').trim())
  else if (releaseMode) fail('Windows Python unavailable', 'needed to build the bundled Light Bridge')
  else warn('Windows Python unavailable', 'only required for `desktop:bridge:build` / installer make')

  if (releaseMode) {
    const installer = spawnSync(python, ['-m', 'PyInstaller', '--version'], { encoding: 'utf8', windowsHide: true })
    if ((installer.status ?? 1) === 0) ok('PyInstaller available', installer.stdout.trim())
    else fail('PyInstaller missing', 'install it in the Light Bridge Python environment before release make')
  }
} else if (releaseMode) {
  fail('Windows release doctor requested on non-Windows host')
}

if (failed) process.exit(1)
console.log('LCOS PASS8 Desktop doctor PASS')
