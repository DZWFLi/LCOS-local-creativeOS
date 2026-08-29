#!/usr/bin/env node
// S2 gate（check:v015-s2）：Skill 一等对象 CRUD。
//   1) 契约完整性：SkillPackageV1 字段 + provenance + 校验函数导出。
//   2) 系统层写保护红线：service 内所有写原语（writeFile/mkdir/rename/rm/cp）的路径参数
//      不得引用 systemDir / systemRoot / systemSkillsRoot——写目标物理限定 user 层。
//      （只读方法 list/validate 引用 systemSkillsRoot 合法。）
//   3) 路由面完整：create/update/version-bump/rename/install/disable/enable/validate 全部接线，
//      census registry 同步。
//   4) provenance 纪律：每个写方法都更新 provenance。
import { readFileSync } from 'node:fs'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约完整性')
{
  const source = readText('packages/contracts/src/skill-package.ts')
  for (const field of ['schemaVersion', 'id', 'name', 'description', 'version', 'role', 'requiredCapabilities', 'optionalCapabilities', 'source', 'disabled', 'provenance']) {
    if (!source.includes(`readonly ${field}`)) errors.push(`SkillPackageV1 缺少字段: ${field}`)
  }
  for (const fn of ['isValidSkillPackageId', 'validateSkillPackageContent']) {
    if (!source.includes(`export function ${fn}`)) errors.push(`skill-package.ts 缺少导出函数: ${fn}`)
  }
  const index = readText('packages/contracts/src/index.ts')
  if (!index.includes("from './skill-package.js'")) errors.push('contracts index 未导出 skill-package')
  ok('SkillPackageV1 11 字段 + 校验函数 + index 导出')
}

console.log('[2/4] 系统层写保护红线（写原语路径审查）')
{
  const service = readText('apps/local-core/src/skill-package-service.ts')
  // 全部写原语调用：逐个检查首个参数是否引用 system 层路径
  const writePrimitives = /(?<!\/\/ .*)\b(await )?(?:writeFile|mkdir|rename|rm|cp)\(/g
  let match
  let writeCalls = 0
  while ((match = writePrimitives.exec(service)) !== null) {
    // 取该调用的参数窗口（到行尾，多行调用取 220 字符窗口）
    const window = service.slice(match.index, match.index + 220)
    const args = window.slice(window.indexOf('(') + 1, window.indexOf(')') > 0 ? window.indexOf(')') : undefined)
    const primitiveMatch = /(?:writeFile|mkdir|rename|rm|cp)\(/.exec(match[0])
    if (primitiveMatch === null) continue
    const primitive = primitiveMatch[0]
    if (primitive === 'cp(') {
      // cp(source, target)：source 允许是 system 层（install 只读源）；target（第二个参数）必须是 user 层
      const secondArg = args.split(',').slice(1).join(',')
      if (/systemDir|systemRoot|systemSkillsRoot/.test(secondArg)) {
        const line = service.slice(0, match.index).split('\n').length
        errors.push(`cp 第 ${line} 行的复制目标引用了 system 层（写保护红线）`)
      }
    } else if (/systemDir|systemRoot|systemSkillsRoot/.test(args)) {
      const line = service.slice(0, match.index).split('\n').length
      errors.push(`写原语 ${primitive} 第 ${line} 行的路径参数引用了 system 层（写保护红线）`)
    }
    writeCalls++
  }
  if (writeCalls < 6) errors.push(`写原语调用数异常（${writeCalls} < 6，检查可能漏扫）`)
  // install 语义：system 只作 cp 源（读）
  if (!/cp\(systemDir, target/.test(service)) errors.push('install 未以 systemDir 为只读源复制到 user 层')
  // 沙箱：user 层 resolve 必须经 safeResolveWithin
  if (!/safeResolveWithin\(userRoot, id\)/.test(service) && !/safeResolveWithin\(userRoot, newId\)/.test(service)) {
    errors.push('user 层路径未走 safeResolveWithin 沙箱')
  }
  ok(`写原语 ${writeCalls} 处全部物理限定 user 层；install 只读复制 system 源`)
}

console.log('[3/4] 路由面完整 + census 同步')
{
  const route = readText('apps/local-core/src/routes/f6-assembly.ts')
  if (!route.includes('(update|version-bump|rename|install|disable|enable)')) {
    errors.push('skill action 路由枚举不完整')
  }
  if (!route.includes('skills\\/validate')) errors.push('路由未接线: skills/validate')
  for (const probe of ['packages.create(', 'packages.update(', 'packages.versionBump(', 'packages.rename(', 'packages.install(', 'packages.setDisabled(']) {
    if (!route.includes(probe)) errors.push(`路由未接线: ${probe}`)
  }
  const compose = readText('apps/local-core/src/compose.ts')
  if (!compose.includes('new SkillPackageService(')) errors.push('compose 未构造 SkillPackageService')
  const server = readText('apps/local-core/src/server.ts')
  if (!server.includes('skillPackages,')) errors.push('server 未传递 skillPackages')

  const census = JSON.parse(readFileSync(repoPath('docs/census/capability-map.v0.json'), 'utf8'))
  const hasSkillActionRoute = census.routes.items.some((item) => item.method === 'POST' && item.path === '/projects/:id/skills/:id/{update|version-bump|rename|install|disable|enable}')
  if (!hasSkillActionRoute) errors.push('census 未包含 skill action 路由——运行 npm run census')
  const hasValidateRoute = census.routes.items.some((item) => item.method === 'POST' && item.path === '/projects/:id/skills/validate')
  if (!hasValidateRoute) errors.push('census 未包含 skills/validate 路由——运行 npm run census')
  ok('8 个操作路由接线 + census 同步')
}

console.log('[4/4] provenance 纪律：每个写方法更新 provenance')
{
  const service = readText('apps/local-core/src/skill-package-service.ts')
  for (const method of ['async create(', 'async update(', 'async versionBump(', 'async rename(', 'async setDisabled(']) {
    const start = service.indexOf(method)
    if (start < 0) { errors.push(`service 缺少方法: ${method}`); continue }
    const next = service.indexOf('\n  async ', start + 10)
    const block = service.slice(start, next < 0 ? undefined : next)
    if (!block.includes('Provenance')) errors.push(`${method.slice(7, -1)} 未写 provenance`)
  }
  ok('5 个写方法全部落 provenance')
}

if (errors.length > 0) {
  console.error('\nS2 gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\nS2 gate PASS')
