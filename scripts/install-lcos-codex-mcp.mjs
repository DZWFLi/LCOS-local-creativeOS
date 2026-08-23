import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(process.env.LCOS_REPO_ROOT || resolve(import.meta.dirname, '..'))
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'))
const configPath = join(codexHome, 'config.toml')
const tokenFile = resolve(process.env.LCOS_CORE_TOKEN_FILE || join(repoRoot, '.codex-runtime', 'local-core-token'))
const servers = [
  {
    name: 'local-creative-os',
    script: join(repoRoot, 'tools', 'lcos-agent', process.platform === 'win32' ? 'launch-local-creative-os-mcp.cmd' : 'launch-local-creative-os-mcp.sh'),
    enabledByDefault: true,
  },
  {
    name: 'lcos-executor',
    script: join(repoRoot, 'tools', 'lcos-agent', process.platform === 'win32' ? 'launch-lcos-executor-mcp.cmd' : 'launch-lcos-executor-mcp.sh'),
    enabledByDefault: false,
  },
]

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
      const candidates = readdirSync(base)
        .map((name) => join(base, name, 'codex.exe'))
        .filter((path) => existsSync(path))
        .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
      if (candidates[0]) return candidates[0]
    }
  }
  return 'codex'
}
function run(codex, args, { allowFailure = false } = {}) {
  const result = spawnSync(codex, args, { encoding: 'utf8', windowsHide: true })
  if (result.error && !allowFailure) fail(`无法执行 Codex CLI：${codex}`, result.error.message)
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    fail(`Codex MCP 命令失败：${args.join(' ')}`, `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim())
  }
  return result
}
function backupConfig() {
  mkdirSync(dirname(configPath), { recursive: true })
  if (!existsSync(configPath)) return undefined
  const backup = `${configPath}.lcos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(configPath, backup)
  console.log(`已备份 Codex 配置：${backup}`)
  return backup
}
function ensureProviderToolExposure() {
  // 第三方 provider（DeepSeek / GPT-5.5 / Any 等）若模型条目为
  // supports_search_tool=true + tool_mode=null，Codex 会走动态工具发现
  // （tool_search），接口不支持时所有 MCP 工具被静默隐藏（openai/codex#31750、
  // #36382 同款）。这里自动修正并备份，保证全新机器部署后 MCP 立即可见。
  const modelsPath = join(codexHome, 'models.json')
  if (!existsSync(modelsPath)) {
    console.log('未找到 models.json，跳过 provider 工具暴露校验。')
    return
  }
  let catalog
  try {
    catalog = JSON.parse(readFileSync(modelsPath, 'utf8'))
  } catch (error) {
    console.warn(`models.json 解析失败，跳过校验：${error.message}`)
    return
  }
  const entries = Array.isArray(catalog?.models) ? catalog.models : []
  const affected = entries.filter(
    (entry) => entry
      && entry.supports_search_tool === true
      && (entry.tool_mode === null || entry.tool_mode === undefined),
  )
  if (affected.length === 0) {
    console.log('models.json 校验通过：无 supports_search_tool=true + tool_mode=null 的模型条目。')
    return
  }
  const backup = `${modelsPath}.lcos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(modelsPath, backup)
  for (const entry of affected) entry.supports_search_tool = false
  writeFileSync(modelsPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`已修正 models.json 的 MCP 工具暴露（${affected.length} 个条目）`)
  console.log(`变更条目：${affected.map((entry) => entry.slug ?? entry.display_name ?? 'unknown').join('、')}`)
  console.log(`备份：${backup}`)
  console.log('原因：supports_search_tool=true + tool_mode=null 会触发动态工具发现；')
  console.log('第三方 provider 不支持 tool_search 时 MCP 工具会被静默隐藏。桌面 App 需重启后生效。')
}
function getServer(codex, name) {
  const result = run(codex, ['mcp', 'get', name, '--json'], { allowFailure: true })
  if ((result.status ?? 1) !== 0) return undefined
  try { return JSON.parse(result.stdout) } catch { return undefined }
}
function looksManaged(value) {
  const text = JSON.stringify(value ?? {})
  return text.includes('lcos-agent') || text.includes('local-creative-os') || text.includes('lcos-executor') || text.includes('127.0.0.1:8920')
}
function looksExactLegacyAiBridge(value) {
  const text = JSON.stringify(value ?? {}).toLowerCase()
  return text.includes('127.0.0.1:8920')
    || text.includes('localhost:8920')
    || text.includes('tools/ai-bridge-runtime')
    || text.includes('bridge_server.py')
}
function removeManaged(codex, name, { exactLegacy = false } = {}) {
  const existing = getServer(codex, name)
  if (!existing) return
  if (exactLegacy && !looksExactLegacyAiBridge(existing)) {
    console.warn(`保留同名 MCP「${name}」：它不匹配 LCOS 旧 ai_bridge 签名。`)
    return
  }
  if (!exactLegacy && !looksManaged(existing)) {
    fail(`Codex 中已存在同名 MCP「${name}」，但无法确认由 LCOS 管理。`, `请检查：codex mcp get ${name} --json`)
  }
  run(codex, ['mcp', 'remove', name])
  console.log(`已移除旧 MCP：${name}`)
}
function patchServerSection(name, values) {
  if (!existsSync(configPath)) return
  let text = readFileSync(configPath, 'utf8')
  const header = `[mcp_servers.${name}]`
  const start = text.indexOf(header)
  if (start < 0) return
  const after = start + header.length
  const next = text.indexOf('\n[', after)
  const end = next < 0 ? text.length : next
  let section = text.slice(start, end).trimEnd()
  for (const [key, value] of Object.entries(values)) {
    const line = `${key} = ${value}`
    const expression = new RegExp(`(^|\\n)${key}\\s*=.*(?=\\n|$)`)
    section = expression.test(section)
      ? section.replace(expression, `$1${line}`)
      : `${section}\n${line}`
  }
  text = text.slice(0, start) + `${section}\n` + text.slice(end)
  writeFileSync(configPath, text, 'utf8')
}

for (const server of servers) if (!existsSync(server.script)) fail(`MCP 启动器不存在：${server.script}`)
const codex = findCodex()
const help = run(codex, ['mcp', 'add', '--help'], { allowFailure: true })
if ((help.status ?? 1) !== 0) fail('当前 Codex CLI 不支持 `codex mcp add`。', `${help.stdout ?? ''}\n${help.stderr ?? ''}`.trim())
backupConfig()
ensureProviderToolExposure()

// Only remove the exact retired name. The backup above makes the cleanup reversible.
removeManaged(codex, 'ai_bridge', { exactLegacy: true })
for (const server of servers) removeManaged(codex, server.name)

for (const server of servers) {
  run(codex, [
    'mcp', 'add', server.name,
    '--env', 'LCOS_CORE_URL=http://127.0.0.1:43121',
    '--env', `LCOS_REPO_ROOT=${repoRoot}`,
    '--env', `LCOS_CORE_TOKEN_FILE=${tokenFile}`,
    '--', server.script,
  ])
  patchServerSection(server.name, {
    enabled: server.enabledByDefault ? 'true' : 'false',
    startup_timeout_sec: '60',
    tool_timeout_sec: '120',
  })
}

for (const server of servers) {
  const verified = run(codex, ['mcp', 'get', server.name, '--json'])
  console.log(`已安装：${server.name}（默认${server.enabledByDefault ? '启用' : '关闭'}）`)
  console.log(verified.stdout.trim())
}
console.log('普通 Codex 会话只启用 local-creative-os；LCOS Runner 会临时启用 lcos-executor 并关闭普通工具面。')
process.parentPort?.postMessage({ type: 'lcos:utility-complete', name: 'Codex MCP setup' })
