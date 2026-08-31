#!/usr/bin/env node
// S1 gate（check:v015-s1）：ExecutionItemV1 统一执行读模型。
//   1) 契约字段完整性：ExecutionItemV1 必须含规格全部字段（id/kind/targetRef/label/state/progress/
//      needsAttention/availableActions/resultRef/proposalRef/createdAt/updatedAt + schemaVersion/runId/provider）。
//   2) 单一来源红线：execution-item-service.ts 与 routes/artifacts.ts 禁止 import bridge-rest-client。
//   3) capability × census 对照：service 声明的 DEFAULT_CAPABILITIES 必须逐项等于
//      docs/census/capability-map.v0.json 的 controlOperations 支持矩阵（防漂移）。
//   4) 路由 + web seam 存在：GET /projects/:id/execution-items 路由与 LocalCoreClient.executionItems 方法。
import { readFileSync } from 'node:fs'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/4] 契约字段完整性')
{
  const contractSource = readText('packages/contracts/src/execution-item.ts')
  const requiredFields = [
    'schemaVersion', 'kind', 'id', 'runId', 'targetRef', 'label', 'state', 'progress',
    'needsAttention', 'availableActions', 'resultRef', 'proposalRef', 'provider', 'createdAt', 'updatedAt',
  ]
  for (const field of requiredFields) {
    if (!contractSource.includes(`readonly ${field}`)) errors.push(`ExecutionItemV1 缺少字段: ${field}`)
  }
  for (const fn of ['deriveAvailableActions', 'executionItemNeedsAttention', 'EXECUTION_ITEM_ACTION_STATES']) {
    if (!contractSource.includes(`export`)) errors.push('execution-item.ts 无导出')
    if (!contractSource.includes(fn)) errors.push(`execution-item.ts 缺少导出: ${fn}`)
  }
  // 状态宇宙 = 七态（与 runs CHECK 一致）
  for (const state of ["'created'", "'queued'", "'running'", "'waiting_input'", "'completed'", "'failed'", "'cancelled'"]) {
    if (!contractSource.includes(state)) errors.push(`ExecutionItemState 缺少状态: ${state}`)
  }
  ok(`字段 ${requiredFields.length} 项 + 七态 + 推导函数齐全`)

  const indexSource = readText('packages/contracts/src/index.ts')
  if (!indexSource.includes("from './execution-item.js'")) errors.push('contracts index 未导出 execution-item')
  ok('contracts index 导出')
}

console.log('[2/4] 单一来源红线：读模型禁止 import bridge-rest-client')
{
  for (const file of ['apps/local-core/src/execution-item-service.ts', 'apps/local-core/src/routes/artifacts.ts']) {
    const source = readText(file)
    if (/^import\b.*bridge-rest-client/m.test(source) || /import\(['"][^'")]*bridge-rest-client/.test(source)) {
      errors.push(`${file} 引用了 bridge-rest-client（单一来源红线）`)
    }
  }
  ok('execution 读模型链路无 bridge-rest-client')
}

console.log('[3/4] capability × S0 census 对照')
{
  const census = JSON.parse(readFileSync(repoPath('docs/census/capability-map.v0.json'), 'utf8'))
  const ops = Object.fromEntries(census.runtime.controlOperations.map((op) => [op.operation, op.supported]))
  const serviceSource = readText('apps/local-core/src/execution-item-service.ts')
  const declared = {
    pause: /pause: true/.test(serviceSource),
    resume: /resume: true/.test(serviceSource),
    cancel: /cancel: true/.test(serviceSource),
    retry: /retry: true/.test(serviceSource),
    answerInput: /answerInput: true/.test(serviceSource),
  }
  const expected = {
    pause: ops.pause === true,
    resume: ops.resume === true,
    cancel: ops.cancel === true,
    retry: ops.retry === true,
    answerInput: ops.answer_input === true,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (declared[key] !== value) {
      errors.push(`capability 漂移: ${key} 声明=${declared[key]} 但 census=${value}——先 npm run census 再同步 EXECUTION_ITEM_DEFAULT_CAPABILITIES`)
    }
  }
  ok('DEFAULT_CAPABILITIES 与 census controlOperations 一致')
}

console.log('[4/4] 路由 + web seam 存在')
{
  const routeSource = readText('apps/local-core/src/routes/artifacts.ts')
  if (!routeSource.includes("execution-items")) errors.push('routes/artifacts.ts 缺少 execution-items 路由')
  if (!/GET/.test(routeSource) || !/ExecutionItemService/.test(routeSource)) errors.push('execution-items 路由未接 ExecutionItemService')

  const clientSource = readText('apps/web/src/runtime/localCoreClient.ts')
  if (!clientSource.includes('executionItems(projectId')) errors.push('LocalCoreClient 缺少 executionItems 方法')
  if (!clientSource.includes('ExecutionItemV1')) errors.push('LocalCoreClient 未 import ExecutionItemV1 类型')

  const appSource = readText('apps/web/src/App.tsx')
  const workRailSource = readText('apps/web/src/features/workrail/WorkRail.tsx')
  const workSurfaceSource = readText('apps/web/src/features/surfaces/WorkSurface.tsx')
  const deliverSurfaceSource = readText('apps/web/src/features/surfaces/DeliverSurface.tsx')
  if (!appSource.includes('client.executionItems(activeProjectId)')) errors.push('Web 尚未消费 Core ExecutionItemV1')
  if (!appSource.includes('const activeRunActions = useMemo<readonly ExecutionItemAction[]>')) errors.push('Web 缺少 active Run 的 canonical availableActions 投影')
  if (appSource.includes('concat(activeRun.status') || appSource.includes('?? (["queued", "running", "waiting_input", "failed"].includes(activeRun.status)')) {
    errors.push('App 仍按 activeRun.status 猜测 runtime actions，必须 fail-close')
  }
  if (!workRailSource.includes('runActions?.includes(action) === true')) errors.push('WorkRail 缺少 strict fail-close action gate')
  if (!workRailSource.includes("canAct(runActions, 'retry') && <button className=\"rail-secondary pressable\" data-testid=\"retry-runtime\"")) errors.push('WorkRail Review retry 仍可绕过 availableActions')
  for (const action of ['cancel', 'retry', 'answer_input']) {
    if (!workSurfaceSource.includes(`canRunAction('${action}')`)) errors.push(`WorkSurface ${action} 仍未受 availableActions 控制`)
  }
  if (!deliverSurfaceSource.includes("runActions.includes('retry')===true")) errors.push('DeliverSurface retry 仍未受 availableActions 控制')

  // census 路由清单应包含新路由（证明 registry 与源码同步）
  const census = JSON.parse(readFileSync(repoPath('docs/census/capability-map.v0.json'), 'utf8'))
  const hasRoute = census.routes.items.some((item) => item.path === '/projects/:id/execution-items' && item.method === 'GET')
  if (!hasRoute) errors.push('census routes 未包含 /projects/:id/execution-items——运行 npm run census 更新 registry')
  ok('路由 + Web fail-close canonical consumption + census registry 同步')
}

if (errors.length > 0) {
  console.error('\nS1 gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\nS1 gate PASS')
