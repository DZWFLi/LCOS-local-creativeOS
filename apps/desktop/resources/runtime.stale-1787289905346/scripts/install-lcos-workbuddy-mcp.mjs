#!/usr/bin/env node
// LCOS → WorkBuddy MCP 集成安装器
// 往 ~/.workbuddy/mcp.json 的 mcpServers 注册 LCOS 的 MCP server（stdio）。
// 与 Codex 版（install-lcos-codex-mcp.mjs）不同：WorkBuddy 的 MCP 配置是 JSON 文件，
// 直接读写即可，不需要 CLI。保留同名但无法确认由 LCOS 管理的 server（fail-closed）。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(process.env.LCOS_REPO_ROOT || resolve(import.meta.dirname, '..'))
const workbuddyHome = resolve(process.env.WORKBUDDY_CONFIG_DIR || join(homedir(), '.workbuddy'))
const configPath = join(workbuddyHome, 'mcp.json')
const tokenFile = resolve(process.env.LCOS_CORE_TOKEN_FILE || join(repoRoot, '.codex-runtime', 'local-core-token'))

const servers = [
  {
    name: 'local-creative-os',
    script: join(repoRoot, 'tools', 'lcos-agent', process.platform === 'win32' ? 'launch-local-creative-os-mcp.cmd' : 'launch-local-creative-os-mcp.sh'),
    enabled: true,
  },
  {
    name: 'lcos-executor',
    script: join(repoRoot, 'tools', 'lcos-agent', process.platform === 'win32' ? 'launch-lcos-executor-mcp.cmd' : 'launch-lcos-executor-mcp.sh'),
    enabled: false,
  },
]

// Utility 完成协议：与 Codex installer 保持一致。
function utilityComplete(ok, error) {
  try {
    process.parentPort?.postMessage({ type: 'lcos-utility-complete', ok, error: error ?? undefined })
  } catch {}
  process.exitCode = ok ? 0 : 1
  setTimeout(() => process.exit(process.exitCode), 250).unref()
}

function fail(message, detail = '') {
  console.error(message)
  if (detail) console.error(detail)
  utilityComplete(false, detail ? `${message}\n${detail}` : message)
}

function readConfig() {
  if (!existsSync(configPath)) return { mcpServers: {} }
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : { mcpServers: {} }
  } catch (error) {
    fail(`WorkBuddy mcp.json 解析失败：${configPath}`, error instanceof Error ? error.message : String(error))
    return { mcpServers: {} }
  }
}

function looksManaged(value) {
  const text = JSON.stringify(value ?? {})
  return text.includes('lcos-agent') || text.includes('local-creative-os') || text.includes('lcos-executor') || text.includes('127.0.0.1:43121')
}

function backupConfig() {
  mkdirSync(dirname(configPath), { recursive: true })
  if (!existsSync(configPath)) return undefined
  const backup = `${configPath}.lcos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(configPath, backup)
  console.log(`已备份 WorkBuddy 配置：${backup}`)
  return backup
}

for (const server of servers) {
  if (!existsSync(server.script)) fail(`MCP 启动器不存在：${server.script}`)
}

backupConfig()
const config = readConfig()
const serversMap = config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : {}
for (const server of servers) {
  const existing = serversMap[server.name]
  if (existing && !looksManaged(existing)) {
    fail(`WorkBuddy 中已存在同名 MCP「${server.name}」，但无法确认由 LCOS 管理。`, `请手动检查 ${configPath}`)
  }
  serversMap[server.name] = {
    command: server.script,
    args: [],
    env: {
      LCOS_REPO_ROOT: repoRoot,
      LCOS_CORE_URL: 'http://127.0.0.1:43121',
      LCOS_CORE_TOKEN_FILE: tokenFile,
    },
    disabled: !server.enabled,
  }
  console.log(`已安装：${server.name}（默认${server.enabled ? '启用' : '关闭'}）`)
}
config.mcpServers = serversMap
mkdirSync(dirname(configPath), { recursive: true })
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

for (const server of servers) {
  console.log(`确认：${server.name} → ${serversMap[server.name].command}`)
}
console.log('WorkBuddy 需在连接器管理页对新增的 LCOS server 点击 Trust 后生效。')
utilityComplete(true)
