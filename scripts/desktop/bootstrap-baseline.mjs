#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows 下 spawnSync('npm.cmd') 会 EINVAL，统一用 node 执行 npm-cli.js（gate 脚本同款方案）。
function resolveNpmCli() {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) return npmExecPath
  for (const candidate of [join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js')]) {
    if (existsSync(candidate)) return candidate
  }
  const rootNpm = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', windowsHide: true })
  if (rootNpm.status === 0) {
    const cli = join(rootNpm.stdout.trim(), 'npm', 'bin', 'npm-cli.js')
    if (existsSync(cli)) return cli
  }
  throw new Error('Cannot locate npm-cli.js; set npm_execpath or run via npm script.')
}
function existsSync(p) {
  try { return Boolean(require('node:fs').statSync(p)) } catch { return false }
}

function run(args) {
  const npmCli = resolveNpmCli()
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: 'inherit', windowsHide: true, env: process.env })
  if (result.error) throw result.error
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}

console.log('LCOS PASS8 baseline bootstrap')
console.log('1/2 Restore workspace dependencies and refresh the lockfile...')
run(['install', '--no-audit', '--no-fund'])
console.log('2/2 Verify the standalone Desktop/Capture baseline...')
run(['run', 'desktop:doctor', '--', '--ready'])
console.log('PASS8 baseline bootstrap complete.')
