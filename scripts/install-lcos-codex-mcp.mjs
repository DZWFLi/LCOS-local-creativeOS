import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const serverPath = join(repoRoot, 'tools', 'lcos-agent', 'mcp-server.mjs')
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'))
const configPath = join(codexHome, 'config.toml')
const serverName = 'local-creative-os'

function fail(message, detail = '') {
  console.error(message)
  if (detail) console.error(detail)
  process.exit(1)
}

function findCodex() {
  const explicit = process.env.CODEX_BIN
  if (explicit && existsSync(explicit)) return explicit
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin')
    if (base && existsSync(base)) {
      const { readdirSync, statSync } = awaitImportFs()
      const candidates = readdirSync(base)
        .map((name) => join(base, name, 'codex.exe'))
        .filter((path) => existsSync(path))
        .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
      if (candidates[0]) return candidates[0]
    }
  }
  return 'codex'
}

function awaitImportFs() {
  // Kept synchronous so the installer works in plain `node` without a build step.
  return requireFs
}

import * as requireFs from 'node:fs'

function run(codex, args, { allowFailure = false } = {}) {
  const result = spawnSync(codex, args, { encoding: 'utf8', windowsHide: true })
  if (result.error && !allowFailure) fail(`无法执行 Codex CLI：${codex}`, result.error.message)
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    fail(`Codex MCP 命令失败：${args.join(' ')}`, `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim())
  }
  return result
}

if (!existsSync(serverPath)) fail(`LCOS MCP server 不存在：${serverPath}`)
const codex = findCodex()
const help = run(codex, ['mcp', 'add', '--help'], { allowFailure: true })
if ((help.status ?? 1) !== 0 || !`${help.stdout ?? ''}${help.stderr ?? ''}`.includes('mcp add')) {
  fail('当前 Codex CLI 不支持 `codex mcp add`，未修改任何配置。', `${help.stdout ?? ''}\n${help.stderr ?? ''}`.trim())
}

mkdirSync(dirname(configPath), { recursive: true })
if (existsSync(configPath)) {
  const backup = `${configPath}.lcos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(configPath, backup)
  console.log(`已备份 Codex 配置：${backup}`)
}

const existing = run(codex, ['mcp', 'get', serverName, '--json'], { allowFailure: true })
if ((existing.status ?? 1) === 0) {
  const parsed = (() => { try { return JSON.parse(existing.stdout) } catch { return null } })()
  const transport = parsed?.transport ?? parsed
  const env = parsed?.env ?? transport?.env ?? {}
  const tokenFile = join(repoRoot, '.codex-runtime', 'local-core-token')
  const same = transport?.type === 'stdio'
    && transport.command === process.execPath
    && Array.isArray(transport.args)
    && transport.args.includes(serverPath)
    && env.LCOS_REPO_ROOT === repoRoot
    && env.LCOS_CORE_TOKEN_FILE === tokenFile
    && env.LCOS_CORE_URL === 'http://127.0.0.1:43121'
    && env.LCOS_BRIDGE_URL === 'http://127.0.0.1:43122'
  if (same) {
    console.log(`LCOS MCP 已是最新配置：${serverName}`)
    process.exit(0)
  }
  const serialized = JSON.stringify(parsed ?? {})
  const looksLikeLegacyLcos = serialized.includes('lcos-agent')
    || serialized.includes('local-creative-os')
    || serialized.includes('127.0.0.1:8920/mcp')
  if (!looksLikeLegacyLcos) {
    fail(
      `Codex 中已经存在同名 MCP「${serverName}」，但无法确认它由 LCOS 管理。安装已停止。`,
      '请检查 `codex mcp get local-creative-os --json`，确认后再手动移除。',
    )
  }
  console.log(`检测到旧版 LCOS MCP，正在备份配置并原位修复：${serverName}`)
  run(codex, ['mcp', 'remove', serverName])
}

run(codex, [
  'mcp', 'add', serverName,
  '--env', 'LCOS_CORE_URL=http://127.0.0.1:43121',
  '--env', 'LCOS_BRIDGE_URL=http://127.0.0.1:43122',
  '--env', `LCOS_REPO_ROOT=${repoRoot}`,
  '--env', `LCOS_CORE_TOKEN_FILE=${join(repoRoot, '.codex-runtime', 'local-core-token')}`,
  '--', process.execPath, serverPath,
])

const verified = run(codex, ['mcp', 'get', serverName, '--json'])
console.log(`已安装并验证 LCOS MCP：${serverName}`)
console.log(verified.stdout.trim())
console.log('请重启 Codex Desktop / CLI 会话，让新 MCP 工具进入会话。')
