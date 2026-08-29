/**
 * 权限门（第一梯队 ⑥ → Phase 6 词汇对齐，20260827）。
 *
 * GUI 入口的 Execution Gate 适配层：判定词汇（MutationRisk）与分级表
 * （packages/contracts execution-gate.ts）同源，保证「同一动作从 GUI/CLI/MCP
 * 进来风险分级一致」（G5/G11）。GUI 语义保持不变：
 * - 只读意图（analyze 等）静默直发——读操作零打扰；
 * - 写意图（create / revise / 未知意图）返回 confirm，由 UI 弹确认卡，
 *   用户确认后才继续发送链；取消则 Run 根本不创建（拒绝不半执行）。
 * confirm 现在附带 risk 标签（reversible=ChangeSet 记账 / structural=未识别意图），
 * 供确认卡展示风险分级；riskOfOperation 未登记的 run 意图 fail-closed 按结构级处理。
 *
 * 纯函数零依赖：不 import 任何运行时模块，判定可独立单测。
 */
import type { MutationRisk } from '@local-creative-os/contracts'

/** GUI 确认卡用的风险标签（与 contracts RISK_LABEL 同义，前端文案层）。 */
const RISK_LABEL: Readonly<Record<MutationRisk, string>> = {
  safe: '只读',
  reversible: '可撤销 · 会记录这次修改，可随时退回',
  structural: '结构性变更',
  destructive: '破坏性操作',
  protected: '受保护对象',
}

/** 权限判定结果：allow=白名单静默放行；confirm=需用户确认（items=将改动的对象清单，risk=风险分级）。 */
export type RunPermissionDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'confirm'; readonly title: string; readonly items: readonly string[]; readonly risk: MutationRisk; readonly riskLabel: string }

/** 只读意图白名单：命中即静默放行（小写归一后比较）。 */
const READ_ONLY_INTENTS: readonly string[] = ['analyze', 'read']

/** run 意图 → 契约风险分级（G5 词汇；与 OPERATION_RISK 的 run 侧语义对齐）。 */
const RUN_INTENT_RISK: Readonly<Record<string, MutationRisk>> = {
  create: 'reversible',
  revise: 'reversible',
}

/**
 * 判定一次 Run 是否需要发送前授权。
 *
 * 规则：
 * - outputIntent 命中只读白名单（analyze 等）→ allow（白名单静默，读零打扰）；
 * - create / revise → confirm + risk=reversible（产出走 ChangeSet 记账，可 revert）；
 * - 未知意图 → confirm + risk=structural（fail-closed：未登记意图当结构级处理）；
 * - confirm 的 items = 涉及对象标题列表（调用方传入，通常为修改目标 + 上下文参考），
 *   空则兜底「当前项目」；instruction 为预留字段（0.1 不做指令级启发式）。
 */
export function evaluateRunPermission(input: {
  readonly outputIntent: string
  readonly instruction: string
  readonly contextTitles: readonly string[]
}): RunPermissionDecision {
  const intent = input.outputIntent.trim().toLowerCase()
  if (READ_ONLY_INTENTS.includes(intent)) return { kind: 'allow' }
  const risk = RUN_INTENT_RISK[intent] ?? 'structural'
  const items = input.contextTitles.map((title) => title.trim()).filter((title) => title.length > 0)
  return {
    kind: 'confirm',
    title: 'Agent 将执行写操作',
    items: items.length > 0 ? items : ['当前项目'],
    risk,
    riskLabel: RISK_LABEL[risk],
  }
}
