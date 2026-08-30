#!/usr/bin/env node
// P0-C gate（check:v015-p0c）：Curator semantic execution bridge。
//   1) 契约完整性：CuratorReorganizeIntentV1 / CuratorReorganizeResultV1 字段 + validateCuratorReorganizeResult + index 导出。
//   2) dispatch 红线：CuratorDispatchService 只能走 AgentletRuntimeService.launch（真实 harness），不得自调 provider / 绕 ReorganizeService。
//   3) ingest 红线：必须经 ReorganizeService.create 持久化（proposal lifecycle 复用），不得直接 mutate canvas / 伪造 proposal。
//   4) 真实 harness 存在：packages/agentlets/lcos-project-curator 有 manifest + main.mjs（非 mock）。
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const contract = readText('packages/contracts/src/curator-dispatch.ts')
  for (const field of ['schemaVersion', 'projectId', 'presentationId', 'surfaceKind', 'surfaceId', 'selectionViewIds', 'intent']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CuratorReorganizeIntentV1 缺少字段: ${field}`)
  }
  for (const field of ['schemaVersion', 'kind', 'agentletId', 'proposal', 'summary']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`CuratorReorganizeResultV1 缺少字段: ${field}`)
  }
  if (!contract.includes('validateCuratorReorganizeResult')) errors.push('缺少 validateCuratorReorganizeResult（schema validation）')
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './curator-dispatch.js'")) errors.push('contracts index 未导出 curator-dispatch')
  ok('契约字段 + validateCuratorReorganizeResult + index 导出')
}

console.log('[2/4] dispatch 红线：走 agentlet line（真实 harness），不绕 ExecutionItem/Reorganize')
{
  const service = readText('apps/local-core/src/curator-dispatch-service.ts')
  if (!service.includes('this.#agentletRuntime.launch(')) errors.push('dispatch 未调用 AgentletRuntimeService.launch（语义执行源缺失）')
  if (service.includes('fetch(')) errors.push('dispatch 直接 fetch provider（绕过 agentlet line）')
  if (!service.includes("CURATOR_AGENTLET_ID")) errors.push('dispatch 未引用 CURATOR_AGENTLET_ID')
  ok('dispatch 仅走 AgentletRuntimeService.launch（无 provider fetch 旁路）')
}

console.log('[3/4] ingest 红线：proposal 经 ReorganizeService.create 持久化（lifecycle 复用，不绕不改 canvas）')
{
  const service = readText('apps/local-core/src/curator-dispatch-service.ts')
  if (!service.includes('this.#reorganize.create(')) errors.push('ingest 未调用 ReorganizeService.create（proposal lifecycle 旁路）')
  if (!service.includes('validateCuratorReorganizeResult(')) errors.push('ingest 未做 schema validation（fail-close 缺失）')
  if (!service.includes('CURATOR_INVALID_OUTPUT')) errors.push('非法输出未映射为 invalid_output')
  if (service.includes('presentation.save(')) errors.push('ingest 直接改 presentation（绕过 ReorganizeService）')
  ok('ingest 经 ReorganizeService.create + schema validation fail-close（不绕不改 canvas）')
}

console.log('[4/4] 真实 harness 存在（非 mock）')
{
  const root = repoPath()
  const manifest = join(root, 'packages/agentlets/lcos-project-curator', 'agentlet.yaml')
  const harness = join(root, 'packages/agentlets/lcos-project-curator', 'main.mjs')
  if (!existsSync(manifest)) errors.push('lcos-project-curator agentlet.yaml 不存在')
  if (!existsSync(harness)) errors.push('lcos-project-curator main.mjs 不存在')
  if (existsSync(harness)) {
    const body = readFileSync(harness, 'utf8')
    if (!body.includes('/curator/ingest')) errors.push('harness 未回传 /curator/ingest')
    if (!body.includes('/curator/semantic')) errors.push('harness 未接入 semantic seam（真实 LLM 接入点）')
    if (!body.includes('LCOS_PROJECT_ID')) errors.push('harness 未读 env 契约')
  }
  ok('lcos-project-curator manifest + harness 存在且回传 ingest + 接入 semantic')
}

if (errors.length > 0) {
  console.error(`\nP0-C gate FAIL (${errors.length}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('\nP0-C gate PASS')