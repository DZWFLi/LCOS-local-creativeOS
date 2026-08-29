#!/usr/bin/env node
// S8 gate（check:v015-s8）：SkillCompositionV1 + requiredCapabilities + update CAS。
//   1) 契约完整性：SkillCompositionV1 / SkillSubskillRefV1 字段 + index 导出。
//   2) 包校验：validateSkillComposition + service.validateComposition。
//   3) CAS：update expectedVersion 版本冲突 + #readVersion 私有方法。
//   4) 环检测红线：resolveSkillDependencyOrder + SkillDependencyCycleError + vitest A→B→A 拒绝。
import { readFileSync } from 'node:fs'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const contract = readText('packages/contracts/src/skill-composition.ts')
  for (const field of ['schemaVersion', 'rootSkillId', 'subskills', 'requiredCapabilities', 'optionalCapabilities']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillCompositionV1 缺少字段: ${field}`)
  }
  for (const field of ['skillId', 'order']) {
    if (!contract.includes(`readonly ${field}`)) errors.push(`SkillSubskillRefV1 缺少字段: ${field}`)
  }
  for (const field of ['label', 'color']) {
    if (!contract.includes(`readonly ${field}?`)) errors.push(`SkillSubskillRefV1 缺少可选字段: ${field}`)
  }
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './skill-composition.js'")) errors.push('contracts index 未导出 skill-composition')
  ok('契约字段 + index 导出')
}

console.log('[2/4] 包校验')
{
  const contract = readText('packages/contracts/src/skill-composition.ts')
  if (!contract.includes('export function validateSkillComposition')) errors.push('缺少 validateSkillComposition')
  const service = readText('apps/local-core/src/skill-package-service.ts')
  if (!service.includes('validateComposition(input: unknown)')) errors.push('service 未暴露 validateComposition')
  ok('validateSkillComposition + service.validateComposition')
}

console.log('[3/4] update 的 expectedVersion CAS')
{
  const service = readText('apps/local-core/src/skill-package-service.ts')
  if (!/\bexpectedVersion\?:/.test(service)) errors.push('update 缺少 expectedVersion 可选参')
  if (!service.includes('Version conflict: expected')) errors.push('update 缺少版本冲突判定')
  if (!service.includes('async #readVersion(skillMdPath')) errors.push('缺少 #readVersion 私有方法')
  ok('expectedVersion CAS + #readVersion')
}

console.log('[4/4] 环检测红线 + 测试')
{
  const contract = readText('packages/contracts/src/skill-composition.ts')
  if (!contract.includes('export function resolveSkillDependencyOrder')) errors.push('缺少 resolveSkillDependencyOrder')
  if (!contract.includes('export class SkillDependencyCycleError')) errors.push('缺少 SkillDependencyCycleError')
  const test = readText('apps/local-core/tests/skill-composition.test.ts')
  if (!test.includes('A→B→A')) errors.push('vitest 缺少 A→B→A 环拒绝用例标签')
  if (!test.includes('toThrow(SkillDependencyCycleError)')) errors.push('vitest 未断言抛出 SkillDependencyCycleError')
  ok('resolveSkillDependencyOrder + A→B→A vitest')
}

if (errors.length > 0) {
  console.error('\nS8 gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\nS8 gate PASS')
