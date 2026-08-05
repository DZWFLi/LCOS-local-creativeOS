import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const withSqliteVec = process.argv.includes('--with-sqlite-vec')
const skipInstall = process.argv.includes('--doctor-only')
const report = []

function command(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    ...options,
  })
}
function check(name, candidates, args = ['--version']) {
  for (const candidate of candidates) {
    const result = command(candidate, args)
    if (!result.error && (result.status ?? 1) === 0) {
      report.push({ name, ok: true, command: candidate, version: (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] })
      return candidate
    }
  }
  report.push({ name, ok: false, command: candidates.join(' | '), version: '' })
  return undefined
}
function runNodeScript(script, args = []) {
  const path = join(root, 'scripts', script)
  const result = command(process.execPath, [path, ...args], { stdio: 'inherit' })
  if (result.error || (result.status ?? 1) !== 0) {
    throw new Error(`${script} 执行失败。`)
  }
}

const node = check('Node.js', [process.execPath])
const npm = check('npm', process.platform === 'win32' ? ['npm.cmd', 'npm'] : ['npm'])
const python = check('Python', process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'])
const codexAppRoot = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin')
  : undefined
const codexAppCandidates = codexAppRoot && existsSync(codexAppRoot)
  ? readdirSync(codexAppRoot)
    .map((name) => join(codexAppRoot, name, 'codex.exe'))
    .filter((path) => existsSync(path))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
  : []
const codexCandidates = [process.env.CODEX_BIN, ...codexAppCandidates, 'codex'].filter(Boolean)
let codex
for (const candidate of codexCandidates) {
  const result = command(candidate, ['--version'])
  if (!result.error && (result.status ?? 1) === 0) {
    codex = candidate
    report.push({ name: 'Codex CLI', ok: true, command: candidate, version: (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] })
    break
  }
}
if (!codex) report.push({ name: 'Codex CLI', ok: false, command: codexCandidates.join(' | '), version: '' })

mkdirSync(join(root, '.codex-runtime'), { recursive: true })
mkdirSync(join(root, '.runtime'), { recursive: true })

process.stdout.write(`${JSON.stringify({ root, doctorOnly: skipInstall, withSqliteVec, checks: report }, null, 2)}\n`)
const missing = report.filter((item) => !item.ok)
if (missing.length > 0) {
  process.stderr.write(`LCOS Bootstrap 停止：缺少 ${missing.map((item) => item.name).join('、')}。\n`)
  process.exit(2)
}
if (!node || !npm || !python || !codex || skipInstall) process.exit(0)

runNodeScript('install-lcos-codex-skill.mjs')
runNodeScript('install-lcos-codex-mcp.mjs')
if (withSqliteVec) runNodeScript('install-sqlite-vec.mjs')

process.stdout.write([
  '',
  'LCOS Bootstrap 已完成。',
  '下一步：',
  '  npm run build:local-core',
  '  npm run dev:open',
  '  npm run check:gatef-plus',
  '',
  `Codex 配置目录：${process.env.CODEX_HOME || join(homedir(), '.codex')}`,
  '普通 Codex 会话启用 local-creative-os；Runner 会临时启用 lcos-executor。',
].join('\n'))
