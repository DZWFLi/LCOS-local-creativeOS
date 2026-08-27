/**
 * Execution Gate · CLI/MCP 共享入口（Phase 6 Execution Safety Core，20260827）。
 *
 * 单一来源纪律：风险矩阵与 OPERATION_RISK 表在 packages/contracts（dist 构建产物）。
 * 本模块 lazy import dist；dist 缺失时回退保守矩阵（写=confirm、读=allow、
 * agent+destructive=deny）——宁可多拦不放过，且不复制矩阵（不产生第二事实源）。
 *
 * 三入口语义：
 * - GUI（permissionGate.ts）：import contracts 源码（workspace 解析），词汇对齐
 * - CLI（本模块）：reversible 静默放行（ChangeSet 记账）；structural stderr 打印
 *   预览后放行（expectedVersion CAS 仍守）；destructive/protected 必须 --yes
 * - MCP（本模块）：allow/preview 放行（propose→accept 与 expectedVersion 已内建
 *   预览纪律）；confirm 阻断（MCP 无人在环确认面）；deny 阻断
 */

const CONTRACTS_DIST = new URL('../../../packages/contracts/dist/index.js', import.meta.url).href

/** dist 加载状态缓存：null=未尝试；false=不可用；object=已加载。 */
let gateImpl = null

async function loadGate() {
  if (gateImpl !== null) return gateImpl
  try {
    const contracts = await import(CONTRACTS_DIST)
    if (typeof contracts.evaluateExecutionGate !== 'function' || typeof contracts.riskOfOperation !== 'function') {
      gateImpl = false
    } else {
      gateImpl = contracts
    }
  } catch {
    gateImpl = false
  }
  return gateImpl
}

/** 保守回退：dist 缺失时用（读=allow、写=confirm、agent 删除=deny）。 */
function fallbackDecision(operation, actor) {
  const knownSafe = SAFE_OPERATIONS.has(operation)
  if (knownSafe) return { kind: 'allow' }
  if (actor === 'mcp_agent' && isDestructiveOperationName(operation)) {
    return { kind: 'deny', risk: 'destructive', reason: 'agent 角色无权执行破坏性操作（gate 回退模式）。' }
  }
  return { kind: 'confirm', risk: 'destructive', reason: 'Execution Gate 未加载（contracts dist 缺失），写操作按最高风险保守处理。' }
}

const SAFE_OPERATIONS = new Set([
  'space.ls', 'space.read', 'space.search', 'context.get', 'context.watch',
  'search.query', 'artifact.preview', 'project.list', 'project.summary',
  'conversation.list', 'conversation.read', 'conversation.search',
])

function isDestructiveOperationName(operation) {
  return /delete|rollback|revert_create/.test(operation)
}

/** CLI 命令 → 契约操作键（OPERATION_RISK 的键）。 */
export const CLI_OPERATION_BY_COMMAND = {
  'node.create-text': 'curation.text.create',
  'node.update-text': 'curation.text.update',
  'curation.apply': 'curation.text.create', // 调用方含 deleteTexts 时覆盖为 artifact.delete
  'presentation.patch': 'presentation.apply',
}

/** MCP agent 工具 → 契约操作键。未登记工具按 safe（现行工具面全为读/提案/Run 生命周期）。 */
export const MCP_OPERATION_BY_TOOL = {
  create_lcos_relation: 'relation.write',
  apply_lcos_context_command: 'context.membership',
  accept_lcos_context_proposal: 'context.membership',
  reject_lcos_context_proposal: 'context.membership',
  propose_lcos_context_change: 'context.membership',
  select_lcos_views: 'curation.text.create',
  focus_lcos_views: 'curation.text.create',
  create_lcos_run: 'curation.text.create',
  dispatch_lcos_run: 'curation.text.create',
  cancel_lcos_run: 'curation.text.create',
  validate_lcos_agent_plan: 'curation.text.create',
  accept_lcos_return: 'context.membership',
  reject_lcos_return: 'context.membership',
  retry_lcos_return: 'curation.text.create',
  answer_lcos_run_input: 'curation.text.create',
  pin_lcos_conversation_message: 'curation.text.create',
  annotate_lcos_conversation_section: 'curation.text.create',
  import_lcos_obsidian_notes: 'capture.stage',
  import_lcos_conversation: 'capture.stage',
}

/** CLI 场景判定：本机操作者默认 workspace 边界（覆盖 project/scene）。 */
export async function evaluateCliGate({ operation, targets = [] }) {
  const gate = await loadGate()
  if (gate === false) return fallbackDecision(operation, 'cli')
  return gate.evaluateExecutionGate({
    risk: gate.riskOfOperation(operation),
    actor: 'cli',
    grantedScope: 'workspace',
    operationScope: 'project',
    targets,
  })
}

/** MCP 场景判定：ROLE executor→mcp_executor，否则 mcp_agent；绑定项目即 project 边界。 */
export async function evaluateMcpGate({ operation, role, targets = [] }) {
  const actor = role === 'executor' ? 'mcp_executor' : 'mcp_agent'
  const gate = await loadGate()
  if (gate === false) return fallbackDecision(operation, actor)
  return gate.evaluateExecutionGate({
    risk: gate.riskOfOperation(operation),
    actor,
    grantedScope: 'project',
    operationScope: 'project',
    targets,
  })
}

/** MCP 放行判定：allow/preview 放行（预览纪律由 propose→accept/expectedVersion 内建）；confirm/deny 阻断。 */
export function mcpDecisionAllows(decision) {
  return decision.kind === 'allow' || decision.kind === 'preview'
}

/** CLI 放行判定：allow 放行；preview 放行（调用方须先打印预览）；confirm 需 --yes；deny 永不放行。 */
export function cliDecisionAllows(decision, hasYes) {
  if (decision.kind === 'allow' || decision.kind === 'preview') return true
  if (decision.kind === 'confirm') return hasYes === true
  return false
}

export function gateRefusalMessage(decision, hint) {
  const head = decision.kind === 'deny'
    ? `DENY（${decision.risk ?? 'unknown'}）: ${decision.reason ?? '越界或角色无权'}`
    : `CONFIRM（${decision.risk ?? 'unknown'}）: ${decision.reason ?? '需要确认'}`
  return `${head}${hint ? ` ${hint}` : ''}`
}
