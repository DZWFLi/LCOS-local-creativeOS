#!/usr/bin/env node
// P0-D gate（check:v015-p0d）：Skill Author semantic execution bridge。
//   1) 契约完整性：SkillAuthorExecuteIntentV1 / SkillAuthorResultV1 字段 + validateSkillAuthorResult + index 导出。
//   2) dispatch 红线：SkillAuthorDispatchService 只能走 AgentletRuntimeService.launch（真实 harness），不得自调 provider。
//   3) ingest 红线：proposal 经 SkillProposalService 持久化（复用 S3 流），不得直接 install / 绕 SkillPackageService CAS。
//   4) 真实 harness 存在：packages/agentlets/lcos-skill-author 有 manifest + main.mjs（非 mock）。
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const contract = readText('packages/contracts/src/skill-author-dispatch.ts')
  for (const field of ['schemaVersion', 'projectId', 'runId']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillAuthorExecuteIntentV1 缺少字段: ${field}`)
  }
  for (const field of ['schemaVersion', 'kind', 'agentletId', 'draft', 'methodFact', 'source', 'summary']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillAuthorResultV1 缺少字段: ${field}`)
  }
  if (!contract.includes('validateSkillAuthorResult')) errors.push('缺少 validateSkillAuthorResult（schema validation）')
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './skill-author-dispatch.js'")) errors.push('contracts index 未导出 skill-author-dispatch')
  ok('契约字段 + validateSkillAuthorResult + index 导出')
}

console.log('[2/4] dispatch 红线：走 agentlet line（真实 harness），不读 not 执行 runtime')
{
  const service = readText('apps/local-core/src/skill-author-dispatch-service.ts')
  if (!service.includes('this.#agentletRuntime.launch(')) errors.push('dispatch 未调用 AgentletRuntimeService.launch（语义执行源缺失）')
  if (service.includes('fetch(')) errors.push('dispatch 直接 fetch provider（绕过 agentlet line）')
  if (!service.includes('SKILL_AUTHOR_AGENTLET_ID')) errors.push('dispatch 未引用 SKILL_AUTHOR_AGENTLET_ID')
  ok('dispatch 仅走 AgentletRuntimeService.launch（无 provider fetch 旁路）')
}

console.log('[3/4] ingest 红线：proposal 经 SkillProposalService 持久化（复用 S3 流，不直接 install）')
{
  const service = readText('apps/local-core/src/skill-author-dispatch-service.ts')
  if (!service.includes('saveSkillProposal(')) errors.push('ingest 未持久化 SkillProposal（旁路）')
  if (!service.includes('validateSkillAuthorResult(')) errors.push('ingest 未做 schema validation（fail-close 缺失）')
  if (!service.includes('SKILL_AUTHOR_INVALID_OUTPUT')) errors.push('非法输出未映射为 invalid_output')
  ok('ingest 经 saveSkillProposal + schema validation fail-close（不直接 install）')
}

console.log('[4/4] 真实 harness 存在（非 mock）')
{
  const root = repoPath()
  const manifest = join(root, 'packages/agentlets/lcos-skill-author', 'agentlet.yaml')
  const harness = join(root, 'packages/agentlets/lcos-skill-author', 'main.mjs')
  if (!existsSync(manifest)) errors.push('lcos-skill-author agentlet.yaml 不存在')
  if (!existsSync(harness)) errors.push('lcos-skill-author main.mjs 不存在')
  if (existsSync(harness)) {
    const body = readFileSync(harness, 'utf8')
    if (!body.includes('/skill-author/ingest')) errors.push('harness 未回传 /skill-author/ingest')
    if (!body.includes('/skill-author/semantic')) errors.push('harness 未接入 semantic seam（真实 LLM 接入点）')
    if (!body.includes('LCOS_PROJECT_ID')) errors.push('harness 未读 env 契约')
  }
  ok('lcos-skill-author manifest + harness 存在且回传 ingest + 接入 semantic')
}

if (errors.length > 0) {
  console.error(`\nP0-D gate FAIL (${errors.length}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('\nP0-D gate PASS')