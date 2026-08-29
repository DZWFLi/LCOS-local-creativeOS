#!/usr/bin/env node
// S4 gate（check:v015-s4）：CompanionRuntime Projection V1 seam。
//   1) 契约完整性：CompanionProjectionV1 字段 + deriveCompanionAvailableActions + index 导出。
//   2) 聚合 service 零新状态：project 聚合各读面；service 禁文件写原语/禁 CREATE TABLE。
//   3) 路由面 + desktop 源码 gate：GET /projects/:id/companion 接线；desktop 禁 import 业务 service。
//   4) census 同步：census.routes 含 GET /projects/:id/companion。
import { readFileSync } from 'node:fs'
import { repoPath, listFiles, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const contract = readText('packages/contracts/src/companion-projection.ts')
  for (const field of ['schemaVersion', 'projectId', 'project', 'receiver', 'activeContext', 'recentCapture', 'pendingReturns', 'executionItems', 'availableActions', 'runtimeStatus', 'generatedAt']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CompanionProjectionV1 缺少字段: ${field}`)
  }
  for (const field of ['id', 'name', 'rootPath', 'activeConversationId']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CompanionProjectV1 缺少字段: ${field}`)
  }
  for (const field of ['binding', 'conversations', 'pendingHandoff']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CompanionReceiverV1 缺少字段: ${field}`)
  }
  for (const field of ['providers', 'bridgeOnline']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CompanionRuntimeStatusV1 缺少字段: ${field}`)
  }
  if (!contract.includes('export function deriveCompanionAvailableActions')) errors.push('缺少 deriveCompanionAvailableActions 聚合导出')
  if (!contract.includes("readonly action: ArtifactReturnAction")) errors.push('CompanionPendingReturnV1.action 类型未对齐 domain ArtifactReturnAction')
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './companion-projection.js'")) errors.push('contracts index 未导出 companion-projection')
  ok('CompanionProjectionV1 字段 + 聚合 helper + index 导出')
}

console.log('[2/4] 聚合 service 零新状态')
{
  const service = readText('apps/local-core/src/companion-projection-service.ts')
  if (!service.includes('async project(projectId: ProjectId')) errors.push('CompanionProjectionService 缺少 project() 聚合入口')
  for (const probe of ['receiverRuntime.getProjectReceiverBinding(', 'activeContext.get(', 'captureStaging.listRecent(', 'runs = this.metadata.getProjectRuns(', 'getArtifactReturns(', 'runtimeApplication.providers(', 'deriveCompanionAvailableActions']) {
    if (!service.includes(probe)) errors.push(`聚合读面缺失: ${probe}`)
  }
  const writePrimitives = /\b(?:writeFile|mkdir|rename|rm|cp|appendFile)\(/g
  if (writePrimitives.test(service)) errors.push('companion-projection-service 自带文件写原语（必须零副作用只投影）')
  if (/CREATE TABLE/i.test(service)) errors.push('companion-projection-service 新建表（禁止新增状态）')
  const compose = readText('apps/local-core/src/compose.ts')
  if (!compose.includes('new CompanionProjectionService(')) errors.push('compose 未构造 CompanionProjectionService')
  if (!compose.includes('companionProjections,')) errors.push('compose 未返回 companionProjections')
  ok('project 聚合七读面 + 零新状态 + compose 接线')
}

console.log('[3/4] 路由面 + desktop 源码 gate')
{
  const route = readText('apps/local-core/src/routes/f6-assembly.ts')
  for (const probe of ['/companion', 'companionProjections.project(', "failure('UNAVAILABLE', 'Companion projection service is not configured.')"]) {
    if (!route.includes(probe)) errors.push(`路由未接线: ${probe}`)
  }
  const server = readText('apps/local-core/src/server.ts')
  if (!server.includes('companionProjections,')) errors.push('server.ts 未把 companionProjections 传入 F6AssemblyRouteContext')

  // desktop 源码 gate：禁止 import local-core 业务 service（只许经 HTTP 桥 / 契约消费）
  const desktopFiles = listFiles('apps/desktop/src', { recursive: true })
  for (const file of desktopFiles) {
    if (!/\.(?:mjs|js|ts|tsx)$/.test(file)) continue
    const src = readText(file).split('\n')
    for (let i = 0; i < src.length; i++) {
      const line = src[i]
      const specifier = /(?:from\s+|import\s+|require\(\s*)[\s'"]*([^'"\s)]*local-core[^'"\s)]*)/.exec(line)
      if (specifier !== null) errors.push(`desktop 禁止 import local-core 业务 service：${file}:${i + 1} → ${specifier[1]}`)
    }
  }
  ok('GET /projects/:id/companion 路由接线 + desktop 源码 gate')
}

console.log('[4/4] census 同步')
{
  const census = JSON.parse(readFileSync(repoPath('docs/census/capability-map.v0.json'), 'utf8'))
  const found = census.routes.items.some((item) => item.method === 'GET' && item.path === '/projects/:id/companion')
  if (!found) errors.push('census 未包含 GET /projects/:id/companion——运行 npm run census')
  ok('census 含 /projects/:id/companion')
}

if (errors.length > 0) {
  console.error('\nS4 gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\nS4 gate PASS')
