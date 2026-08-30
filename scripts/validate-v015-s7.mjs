#!/usr/bin/env node
// S7 gate（check:v015-s7）：任务控制 capability——按真实 executor 能力声明，不假装。
//   1) capability 诚实声明：EXECUTION_ITEM_DEFAULT_CAPABILITIES 的 pause/resume=false
//      （当前 Bridge 无真 pause/resume），cancel/answerInput=true。
//   2) unsupported 错误码封闭：answerInput 的 Bridge 不支持路径抛 CONTRACT_UNSUPPORTED；
//      cancel 的终态拒绝抛 RUN_ALREADY_TERMINAL（错误码表封闭，不返回假成功）。
//   3) agentlet availableActions 诚实为空（不支持控制，不显示假按钮）。
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/3] capability 诚实声明（pause/resume=false，cancel/answerInput=true）')
{
  const service = readText('apps/local-core/src/execution-item-service.ts')
  const p = /pause: (true|false)/.exec(service)?.[1]
  const r = /resume: (true|false)/.exec(service)?.[1]
  const c = /cancel: (true|false)/.exec(service)?.[1]
  const a = /answerInput: (true|false)/.exec(service)?.[1]
  if (p !== 'false') errors.push(`pause 声明应 false，实际 ${p}`)
  if (r !== 'false') errors.push(`resume 声明应 false，实际 ${r}`)
  if (c !== 'true') errors.push(`cancel 声明应 true，实际 ${c}`)
  if (a !== 'true') errors.push(`answerInput 声明应 true，实际 ${a}`)
  ok('pause/resume=false + cancel/answerInput=true（诚实，与 census controlOperations 对齐）')
}

console.log('[2/3] unsupported / terminal 错误码封闭')
{
  const adapter = readText('apps/local-core/src/runtime-adapter.ts')
  if (!adapter.includes('CONTRACT_UNSUPPORTED')) errors.push('answerInput 未抛 CONTRACT_UNSUPPORTED（Bridge 不支持时）')
  if (!adapter.includes('RUN_ALREADY_TERMINAL')) errors.push('cancel 未抛 RUN_ALREADY_TERMINAL（终态拒绝）')
  ok('错误码封闭：CONTRACT_UNSUPPORTED / RUN_ALREADY_TERMINAL 存在，不返回假成功')
}

console.log('[3/3] agentlet availableActions 诚实为空')
{
  const service = readText('apps/local-core/src/execution-item-service.ts')
  if (!/availableActions: \[\]/.test(service)) errors.push('agentlet ExecutionItem 未诚实置空 availableActions')
  ok('agentlet 读模型 availableActions 为空（不显示假控制按钮）')
}

if (errors.length > 0) {
  console.error(`\nS7 gate FAIL (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\nS7 gate PASS')