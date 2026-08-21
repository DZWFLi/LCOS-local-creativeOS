#!/usr/bin/env node
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'win32') {
  console.error('desktop bridge bundle must be built on Windows')
  process.exit(2)
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bridgeRoot = join(root, 'tools', 'light-bridge-kernel')
const outRoot = join(bridgeRoot, 'dist-desktop')
const pythonCandidates = [
  join(bridgeRoot, '.venv', 'Scripts', 'python.exe'),
  join(bridgeRoot, '.codex-runtime', 'bridge-test-venv', 'Scripts', 'python.exe'),
]
const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON ?? pythonCandidates.find(existsSync) ?? 'python.exe'

function run(args) {
  const result = spawnSync(python, args, { cwd: bridgeRoot, stdio: 'inherit', windowsHide: true, env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const probe = spawnSync(python, ['-m', 'PyInstaller', '--version'], { cwd: bridgeRoot, stdio: 'ignore', windowsHide: true })
if (probe.status !== 0) {
  console.error('PyInstaller 未安装。请在 LCOS bridge Python 环境执行：python -m pip install pyinstaller')
  process.exit(3)
}
rmSync(outRoot, { recursive: true, force: true })
run([
  '-m', 'PyInstaller',
  '--noconfirm', '--clean', '--onedir',
  '--name', 'lcos-bridge',
  '--distpath', outRoot,
  '--workpath', join(bridgeRoot, '.desktop-build'),
  '--specpath', join(bridgeRoot, '.desktop-build'),
  '--paths', join(bridgeRoot, 'src'),
  '--collect-submodules', 'uvicorn',
  '--collect-submodules', 'fastapi',
  '--collect-submodules', 'pydantic',
  join(bridgeRoot, 'desktop_entry.py'),
])
console.log(`Bundled Light Bridge: ${join(outRoot, 'lcos-bridge')}`)
