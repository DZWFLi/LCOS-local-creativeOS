/**
 * 权限门（第一梯队 ⑥）：Agent 写操作的「发送前」授权判定。
 *
 * 参考 grok-bot local-tool-permission 的三级分级机制（白名单放行 / 询问 / 拒绝），
 * 只抄机制不抄样式：
 * - 白名单放行：只读意图（analyze 等只读语义）静默直发——读操作零打扰；
 * - 询问：写意图（create / revise / 未知意图）返回 confirm，由 UI 弹确认卡，
 *   用户确认后才继续发送链；取消则 Run 根本不创建（拒绝不半执行）。
 *
 * 纯函数零依赖：不 import 任何运行时模块，判定可独立单测。
 */

/** 权限判定结果：allow=白名单静默放行；confirm=需用户确认（items=将改动的对象清单）。 */
export type RunPermissionDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'confirm'; readonly title: string; readonly items: readonly string[] }

/** 只读意图白名单：命中即静默放行（小写归一后比较）。 */
const READ_ONLY_INTENTS: readonly string[] = ['analyze', 'read']

/**
 * 判定一次 Run 是否需要发送前授权。
 *
 * 规则：
 * - outputIntent 命中只读白名单（analyze 等）→ allow（白名单静默，读零打扰）；
 * - 其余（create / revise / 未知写语义）→ confirm：宁可多问一句，不静默改东西
 *   （fail-closed：未知意图一律当写操作处理）；
 * - confirm 的 items = 涉及对象标题列表（调用方传入，通常为修改目标 + 上下文参考），
 *   空则兜底「当前项目」；instruction 为预留字段（0.1 不做指令级启发式）。
 */
export function evaluateRunPermission(input: {
  readonly outputIntent: string
  readonly instruction: string
  readonly contextTitles: readonly string[]
}): RunPermissionDecision {
  if (READ_ONLY_INTENTS.includes(input.outputIntent.trim().toLowerCase())) return { kind: 'allow' }
  const items = input.contextTitles.map((title) => title.trim()).filter((title) => title.length > 0)
  return {
    kind: 'confirm',
    title: 'Agent 将执行写操作',
    items: items.length > 0 ? items : ['当前项目'],
  }
}
