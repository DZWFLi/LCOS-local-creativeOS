#!/usr/bin/env node
// S0 汇总：运行七个 census 提取器 → docs/census/capability-map.v0.json + capability-map.v0.md
// 纪律：输出必须确定性（无时间戳），gate 用「重生成 == 已提交」证明机器生成、无手工漂移。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath } from './census-shared.mjs'
import { censusRoutes } from './census-routes.mjs'
import { censusCli } from './census-cli.mjs'
import { censusMcp } from './census-mcp.mjs'
import { censusSkills } from './census-skills.mjs'
import { censusRuntime } from './census-runtime.mjs'
import { censusSearch } from './census-search.mjs'
import { censusDesktop } from './census-desktop.mjs'

export function buildCapabilityMap() {
  return {
    schemaVersion: '0.1',
    generator: 'scripts/census-capability-map.mjs',
    routes: censusRoutes(),
    cli: censusCli(),
    mcp: censusMcp(),
    skills: censusSkills(),
    runtime: censusRuntime(),
    search: censusSearch(),
    desktop: censusDesktop(),
  }
}

function markdown(map) {
  const lines = []
  lines.push('# LCOS Capability Map v0（机器生成）')
  lines.push('')
  lines.push('> 由 `npm run census` 从源码生成；禁止手工编辑（`npm run check:census` 校验重生成一致性）。')
  lines.push('> 生成时间不写入文件以保证确定性；本表即 Capability Registry v0 数据源（S 系列施工计划 S0 交付物）。')
  lines.push('')
  lines.push('## 总览')
  lines.push('')
  lines.push('| 域 | 能力数 | 源 |')
  lines.push('|---|---|---|')
  lines.push(`| HTTP Routes | ${map.routes.total} | apps/local-core/src/routes/*.ts + server.ts |`)
  lines.push(`| CLI 命令 | ${map.cli.total} | tools/lcos-agent/cli.mjs + commands/*.mjs |`)
  lines.push(`| MCP 工具 | ${map.mcp.totalTools}（agent ${map.mcp.roleExposure.agent} / executor ${map.mcp.roleExposure.executor}） | tools/lcos-agent/mcp-server.mjs + executor-tools.mjs |`)
  lines.push(`| Skills | ${map.skills.total} | packages/skills/*/SKILL.md |`)
  lines.push('')

  lines.push('## Routes（按 method）')
  lines.push('')
  lines.push('| method | 数量 |')
  lines.push('|---|---|')
  for (const [method, count] of Object.entries(map.routes.byMethod)) lines.push(`| ${method} | ${count} |`)
  lines.push('')
  lines.push(`mutationClass 分布：${Object.entries(map.routes.byMutationClass).map(([k, v]) => `${k}=${v}`).join('、')}`)
  lines.push('')

  lines.push('## MCP 工具 × 域 × 角色')
  lines.push('')
  lines.push('| 域 | 工具数 |')
  lines.push('|---|---|')
  for (const [domain, count] of Object.entries(map.mcp.domains)) lines.push(`| ${domain} | ${count} |`)
  lines.push('')
  lines.push(`工具注册调用：mcp-server.mjs ${map.mcp.registeredToolCalls['mcp-server.mjs']} 个、executor-tools.mjs ${map.mcp.registeredToolCalls['executor-tools.mjs']} 个。`)
  if (map.mcp.deadDomains.length > 0) {
    lines.push('')
    lines.push(`漂移发现：domainOf 声明了 ${map.mcp.deadDomains.join('、')} 域但无任何注册工具落入（该域能力只剩 CLI/路由入口）。`)
  }
  lines.push('')

  lines.push('## CLI 命令（按组）')
  lines.push('')
  lines.push('| 组 | 命令数 |')
  lines.push('|---|---|')
  for (const [group, count] of Object.entries(map.cli.groups)) lines.push(`| ${group} | ${count} |`)
  lines.push('')

  lines.push('## Runtime 状态分类')
  lines.push('')
  lines.push(`- runs 状态：${map.runtime.runStates.join(' / ')}`)
  lines.push(`- Session 七态：${map.runtime.sessionPhases.join(' / ')}`)
  lines.push(`- provider 可用性：${map.runtime.providerAvailability.join(' / ')}`)
  lines.push('')
  lines.push('### 控制操作支持矩阵（源码裁定）')
  lines.push('')
  lines.push('| 操作 | 支持 | 锚点 |')
  lines.push('|---|---|---|')
  for (const op of map.runtime.controlOperations) {
    lines.push(`| ${op.operation} | ${op.supported ? 'YES' : 'NO'} | ${op.anchors.map((a) => a.evidence).join('; ') || '（无源码锚点）'} |`)
  }
  lines.push('')

  lines.push('## Search / 索引覆盖')
  lines.push('')
  lines.push(`- 实体类型：${map.search.entityTypes.join(' / ')}`)
  lines.push(`- 分析器：${map.search.analyzers.map((a) => a.id ?? a.file.split('/').at(-1)).join('、')}`)
  lines.push(`- FTS5 表：${map.search.lexicalIndex.tables.map((t) => t.table).join('、')}`)
  lines.push(`- 向量存储：${map.search.vectorIndex.stores.length} 处 vec0 声明`)
  lines.push(`- embedding 默认模型：${map.search.embeddingProvider.providerEvidence.defaultModel ?? '未提取'}（单一本地 provider——S9 缺口）`)
  lines.push(`- OCR：${map.search.ocr.present ? `存在（${map.search.ocr.referencedBy.join('、')}）` : '不存在'}`)
  lines.push('')

  lines.push('## Skills')
  lines.push('')
  lines.push('| 包 | 版本 | role | requiredCapabilities |')
  lines.push('|---|---|---|---|')
  for (const skill of map.skills.items) {
    lines.push(`| ${skill.package} | ${skill.version ?? '—'} | ${skill.role ?? '—'} | ${skill.requiredCapabilitiesDeclared ? skill.requiredCapabilities : '（未声明）'} |`)
  }
  lines.push('')
  lines.push(`声明 requiredCapabilities 的 Skill：${map.skills.declaredRequiredCapabilities}/${map.skills.total}（S8 缺口如实登记）。`)
  lines.push('')

  lines.push('## Desktop')
  lines.push('')
  lines.push(`- BrowserWindow 创建点：${map.desktop.windows.browserWindowCreationSites.map((w) => w.creationSite ?? 'anonymous').join('、')}`)
  lines.push(`- Tray：${map.desktop.windows.trayPresent ? '有' : '无'}`)
  lines.push(`- ipcMain.handle 通道：${map.desktop.ipc.mainHandleChannels.length} 个；preload invoke 通道：${map.desktop.ipc.preloadInvokeChannels.length} 个`)
  lines.push(`- Runtime Supervisor：${map.desktop.runtimeSupervisor.present ? '存在' : '缺失'}`)
  lines.push(`- Companion Runtime Projection 契约：${map.desktop.companionRuntimeProjection.contractFiles.length === 0 ? '无（S4 缺口）' : map.desktop.companionRuntimeProjection.contractFiles.join('、')}`)
  lines.push('')
  lines.push('## 纪律')
  lines.push('')
  lines.push('- 本文件与 capability-map.v0.json 全部由 `scripts/census-capability-map.mjs` 生成，手工编辑会被 check:census 拒绝。')
  lines.push('- 生成器内禁止硬编码能力清单：gate 逐条校验每个能力项都能在其声明的源文件中找到锚点。')
  lines.push('- 数字与源码一致是 S0 验收线；后续 S 系列任务以本 registry 为唯一能力事实源。')
  lines.push('')
  lines.push('## S0 裁定记录：CLI / MCP / Bridge 施工落点（20260830）')
  lines.push('')
  lines.push('| 面 | 落点 | 仓 |')
  lines.push('|---|---|---|')
  lines.push('| CLI | tools/lcos-agent/cli.mjs + commands/*.mjs | 本仓 |')
  lines.push('| Agent MCP | tools/lcos-agent/mcp-server.mjs + executor-tools.mjs + mcp-executor-server.mjs + lib/mcp-stdio-runtime.mjs | 本仓 |')
  lines.push('| Browser Bridge MCP | tools/lcos-browser-bridge（Python mcp_server.py） | 本仓 |')
  lines.push('| Bridge 执行面 | scripts/light-bridge.mjs（Node 入口）+ tools/light-bridge-kernel（Python kernel） | 本仓 |')
  lines.push('| Runtime 服务注册 | tools/lcos-runtime/capabilities.json（独立 gate：check-capability-registry.mjs） | 本仓 |')
  lines.push('')
  lines.push('裁定：CLI / MCP / Bridge 施工落点全部在本仓；父目录历史仓只作考古参照，不回写。')
  return lines.join('\n') + '\n'
}

export function writeCapabilityMap() {
  const map = buildCapabilityMap()
  const jsonPath = repoPath('docs/census/capability-map.v0.json')
  const mdPath = repoPath('docs/census/capability-map.v0.md')
  mkdirSync(dirname(jsonPath), { recursive: true })
  const json = JSON.stringify(map, null, 2) + '\n'
  writeFileSync(jsonPath, json)
  writeFileSync(mdPath, markdown(map))
  console.log(`capability map written: ${jsonPath} (${Buffer.byteLength(json)} bytes)`)
  console.log(`markdown written: ${mdPath}`)
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-capability-map.mjs')) {
  writeCapabilityMap()
}
