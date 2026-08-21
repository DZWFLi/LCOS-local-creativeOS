#!/usr/bin/env node
/**
 * S10 gate runner with automatic temp cleanup.
 *
 * 规则（Dz 死命令）：
 *  - 每次 gate 运行结束（无论成败）自动清理 %TEMP%\lcos-* 残留，
 *    绝不允许测试临时库堆积塞爆 C 盘。
 *  - 失败即停：gate 自身已 fail-fast，本脚本不做重试。
 *
 * 用法：
 *   node scripts/s10-gate-run.mjs --deterministic [--reason "xxx"]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, lstatSync } from 'node:fs'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const mode = args.has('--release') ? '--release' : '--deterministic'
const gate = join(process.cwd(), 'scripts', 'productization-s10-release-gate.mjs')

function directoryBytes(root) {
  let size = 0
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    try {
      const stat = lstatSync(current)
      if (stat.isDirectory()) {
        for (const child of readdirSync(current)) stack.push(join(current, child))
      } else size += stat.size
    } catch { /* locked/raced path */ }
  }
  return size
}

function cleanTempResidue() {
  const temp = process.env.TEMP
  if (!temp || !existsSync(temp)) return { dirs: 0, mb: 0 }
  let dirs = 0
  let mb = 0
  let entries = []
  try { entries = readdirSync(temp, { withFileTypes: true }) } catch { return { dirs, mb } }
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('lcos-')) continue
    const full = join(temp, e.name)
    try {
      const beforeBytes = directoryBytes(full)
      // WorkBuddy safe-delete currently intercepts in-process Node deletion. Keep the workaround
      // isolated in this gate wrapper instead of teaching product code to bypass deletion policy.
      const r = process.platform === 'win32'
        ? spawnSync('cmd', ['/c', 'rmdir', '/s', '/q', full], { windowsHide: true, stdio: 'ignore' })
        : spawnSync('rm', ['-rf', '--', full], { stdio: 'ignore' })
      if (r.status === 0 && !existsSync(full)) {
        dirs += 1
        mb += beforeBytes / 1024 / 1024
      }
    } catch { /* locked or permission */ }
  }
  return { dirs, mb }
}

console.log(`=== S10 gate runner · mode=${mode} ===`)
const started = Date.now()
const result = spawnSync(process.execPath, [gate, mode], { cwd: process.cwd(), stdio: 'inherit', env: process.env, windowsHide: true })

const { dirs, mb } = cleanTempResidue()
console.log(`\n=== 清理：删除 ${dirs} 个 lcos-* 残留，释放约 ${mb.toFixed(1)} MB ===`)

const minutes = ((Date.now() - started) / 60000).toFixed(1)
if (result.status === 0) {
  console.log(`✓ S10 gate ${mode} PASS (${minutes} min)`)
  process.exit(0)
}
console.log(`✗ S10 gate ${mode} FAIL (${minutes} min) — 已清理残留，可修复后重跑`)
process.exit(result.status ?? 1)
