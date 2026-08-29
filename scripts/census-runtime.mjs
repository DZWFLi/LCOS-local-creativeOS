#!/usr/bin/env node
// S0 census-runtime：机器提取运行时状态分类 × 控制操作支持矩阵。
// 锚点（S0-1 摸底实测）：
//   runs 等表状态：metadata-repository.ts 的 CREATE TABLE ... CHECK(status IN (...))（含无 IF NOT EXISTS 形态）
//   会话七态：packages/contracts/src/session-lifecycle.ts 的 SessionPhase union
//   provider 可用性：packages/contracts/src/index.ts 的 RuntimeProviderAvailability union
//   providerStatus：apps/local-core/src/runtime-adapter.ts 的 providerStatus 字面量联合
// 控制操作候选集来自审计 §4.3（pause/resume/cancel/retry/answer_input）；
// 支持与否由「路由 census 的 run/task 域路径 + MCP 工具名」机器裁定，锚点逐条登记。
import { readText, extractStringUnion } from './census-shared.mjs'
import { censusMcp } from './census-mcp.mjs'
import { censusRoutes } from './census-routes.mjs'

const METADATA_REPO = 'apps/local-core/src/metadata-repository.ts'
const SESSION_LIFECYCLE = 'packages/contracts/src/session-lifecycle.ts'
const CONTRACTS_INDEX = 'packages/contracts/src/index.ts'
const RUNTIME_ADAPTER = 'apps/local-core/src/runtime-adapter.ts'

/** 提取所有带 status CHECK 约束的表：{ table: [states] }。 */
function extractStatusChecks(source) {
  const tables = {}
  const createPattern = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\s*\)/g
  let match
  while ((match = createPattern.exec(source)) !== null) {
    const check = /CHECK\(status IN \(([^)]*)\)\)/.exec(match[2])
    if (check !== null) {
      tables[match[1]] = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    }
  }
  return tables
}

/** 控制操作候选（审计 §4.3 规格宇宙）→ run/task 域路径正则 + 工具名正则。 */
const OP_PROBES = {
  pause: { route: /\/(runs|tasks)\/[^']*\/pause/, tool: /^pause_lcos/ },
  resume: { route: /\/(runs|tasks)\/[^']*\/resume/, tool: /^resume_lcos/ },
  cancel: { route: /\/(runs|tasks)\/[^']*\/cancel/, tool: /^cancel_lcos/ },
  retry: { route: /\/(runs|tasks|returns)\/[^']*\/retry/, tool: /retry_lcos/ },
  answer_input: { route: /\/runs\/[^']*\/input/, tool: /^(answer_lcos_run_input|request_lcos_user_input)$/ },
}

function controlOperations(routeItems, mcpToolNames) {
  return Object.entries(OP_PROBES).map(([operation, probe]) => {
    const anchors = []
    for (const item of routeItems) {
      if (probe.route.test(item.path)) {
        anchors.push({ kind: 'route', evidence: `${item.method} ${item.path}`, file: item.file })
      }
    }
    for (const tool of mcpToolNames) {
      if (probe.tool.test(tool)) anchors.push({ kind: 'mcp-tool', evidence: tool })
    }
    return { operation, supported: anchors.length > 0, anchors }
  })
}

export function censusRuntime() {
  const metadataSource = readText(METADATA_REPO)
  const statusChecks = extractStatusChecks(metadataSource)

  // 路由与 MCP 能力复用各自 census（单一事实源，不重复解析）
  const routes = censusRoutes()
  const mcp = censusMcp()

  const providerStatusMatch = /readonly providerStatus: ([\s\S]*?)(?:\n|;)/.exec(readText(RUNTIME_ADAPTER))

  // run 域的 runtime action 路由（{dispatch|recover|sync} 等）作为附加事实登记
  const runtimeActionRoutes = routes.items
    .filter((item) => /\/runs\/:id\/\{[\w|]+\}/.test(item.path))
    .map((item) => ({ method: item.method, path: item.path, file: item.file }))

  return {
    source: {
      statusChecks: METADATA_REPO,
      sessionPhases: SESSION_LIFECYCLE,
      providerAvailability: CONTRACTS_INDEX,
      providerStatus: RUNTIME_ADAPTER,
      controlOperations: 'census-routes（run/task 域路径）+ census-mcp（工具名）',
    },
    runStates: statusChecks.runs ?? [],
    tableStatusTaxonomy: statusChecks,
    sessionPhases: extractStringUnion(readText(SESSION_LIFECYCLE), 'SessionPhase'),
    providerAvailability: extractStringUnion(readText(CONTRACTS_INDEX), 'RuntimeProviderAvailability'),
    providerStatus: providerStatusMatch === null ? [] : [...providerStatusMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
    runtimeActionRoutes,
    controlOperations: controlOperations(routes.items, mcp.items.map((item) => item.name)),
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-runtime.mjs')) {
  console.log(JSON.stringify(censusRuntime(), null, 2))
}
