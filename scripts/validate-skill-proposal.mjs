#!/usr/bin/env node
// S3 gate（check:v015-s3）：RunRecipe → Skill Proposal seam。
//   1) 契约完整性：SkillProposalV1 字段 + draft/source + 状态机四态。
//   2) 复用红线 A——审批通道：skill-proposal-service 必须发射与 ContextProposalStore
//      完全同款的 proposal.changed 事件（channel/type/payload 逐字段比对）；
//      状态机四态与 context_proposals CHECK 一致。
//   3) 复用红线 B——Skill Builder：accept 落盘必须调用 SkillPackageService.create
//      （service 不得自带写文件原语——旁路检测）。
//   4) 路由面 + census 同步：propose/list/accept/reject 四路由注册。
import { readFileSync } from 'node:fs'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const contract = readText('packages/contracts/src/skill-proposal.ts')
  for (const field of ['schemaVersion', 'proposalId', 'projectId', 'source', 'draft', 'status', 'createdBy', 'createdAt', 'updatedAt']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillProposalV1 缺少字段: ${field}`)
  }
  for (const field of ['runId', 'prompt', 'intent', 'orderedReferenceCount', 'provider', 'runCompletedAt']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillProposalSourceV1 缺少字段: ${field}`)
  }
  for (const field of ['skillId', 'name', 'description', 'content']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillProposalDraftV1 缺少字段: ${field}`)
  }
  // 状态机四态 = context proposal 同款
  for (const state of ["'pending'", "'accepted'", "'rejected'", "'stale'"]) {
    if (!contract.includes(state)) errors.push(`SkillProposalStatusV1 缺少状态: ${state}`)
  }
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './skill-proposal.js'")) errors.push('contracts index 未导出 skill-proposal')
  ok('契约字段 + 四态状态机 + index 导出')
}

console.log('[2/4] 复用红线 A：审批通道（事件 + 状态机同款）')
{
  const service = readText('apps/local-core/src/skill-proposal-service.ts')
  const contextStore = readText('apps/local-core/src/context-proposal-store.ts')

  // 事件逐字段比对：channel/type/payload 与 ContextProposalStore #emit 一致
  const contextEmit = contextStore.match(/#emit\(projectId: string\): void \{[\s\S]*?\n  \}/)?.[0] ?? ''
  for (const fragment of ["channel: 'proposal'", "type: 'proposal.changed'", 'payload: { invalidated: true }']) {
    if (!service.includes(fragment)) errors.push(`事件通道旁路：skill-proposal-service 缺少 ${fragment}（必须与 ContextProposalStore 一致）`)
    if (!contextEmit.includes(fragment)) errors.push(`比对基准异常：context-proposal-store #emit 不含 ${fragment}`)
  }
  // 状态机：pending 才可 accept/reject（与 ContextProposalStore 一致）
  if (!/status !== 'pending'/.test(service)) errors.push('状态机旁路：accept/reject 未校验 pending 前置态')
  ok('proposal.changed 事件 + pending 前置态与 ContextProposalStore 同款')
}

console.log('[3/4] 复用红线 B：accept 必须经 S2 Skill Builder（旁路检测）')
{
  const service = readText('apps/local-core/src/skill-proposal-service.ts')
  // accept 必须调用 skillPackages.create
  const acceptMatch = /async accept\(projectId: string, proposalId: string\)[\s\S]*?(?=\n  reject)/.exec(service)
  const acceptBlock = acceptMatch === null ? '' : acceptMatch[0]
  if (!acceptBlock.includes('this.skillPackages.create(')) errors.push('accept 未调用 SkillPackageService.create（Skill Builder 旁路）')
  // service 自身不得有任何文件写原语（落盘只许经 Builder）
  const writePrimitives = /\b(?:writeFile|mkdir|rename|rm|cp)\(/g
  if (writePrimitives.test(service)) errors.push('skill-proposal-service 自带文件写原语（必须经 SkillPackageService，禁止旁路）')
  // 提案表模式与 context_proposals 同款
  const repo = readText('apps/local-core/src/metadata-repository.ts')
  const skillTable = /CREATE TABLE IF NOT EXISTS skill_proposals \(([\s\S]*?)\);/.exec(repo)?.[1] ?? ''
  for (const probe of ['proposal_id TEXT PRIMARY KEY', "CHECK(status IN ('pending','accepted','rejected','stale'))", 'proposal_json TEXT NOT NULL']) {
    if (!skillTable.includes(probe)) errors.push(`skill_proposals 表模式与 context_proposals 不一致（缺 ${probe}）`)
  }
  ok('accept 经 SkillPackageService.create；service 零文件写原语；表模式同款')
}

console.log('[4/4] 路由面 + census 同步')
{
  const route = readText('apps/local-core/src/routes/f6-assembly.ts')
  for (const probe of ['skill-proposal', 'skill-proposals', 'proposals.proposeFromRun(', 'proposals.accept(', 'proposals.reject(', 'proposals.list(']) {
    if (!route.includes(probe)) errors.push(`路由未接线: ${probe}`)
  }
  const compose = readText('apps/local-core/src/compose.ts')
  if (!compose.includes('new SkillProposalService(')) errors.push('compose 未构造 SkillProposalService')

  const census = JSON.parse(readFileSync(repoPath('docs/census/capability-map.v0.json'), 'utf8'))
  for (const expected of [
    'POST /runs/:id/skill-proposal',
    'GET /projects/:id/skill-proposals',
    'POST /projects/:id/skill-proposals/:id/{accept|reject}',
  ]) {
    const [method, path] = expected.split(' ')
    if (!census.routes.items.some((item) => item.method === method && item.path === path)) {
      errors.push(`census 未包含 ${expected}——运行 npm run census`)
    }
  }
  ok('4 路由接线 + census 同步')
}

if (errors.length > 0) {
  console.error('\nS3 gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\nS3 gate PASS')
