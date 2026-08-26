import type { ConnectedConversationV1, ProjectHandoffPackV1 } from '@local-creative-os/contracts'

/** RECEIVER-3 切换现场快照：App.tsx 从真实状态（当前视图 + 当前选中 + 待确认数）组装，传给承接确认小卡。 */
export interface ReceiverHandoffContext {
  readonly surface: { readonly kind: 'main' | 'context' | 'workflow'; readonly surfaceId: string }
  readonly selectionEntityIds: readonly string[]
  /** 未完成事项（待确认的 Run 返回结果数）；0 表示无。 */
  readonly pendingReviewCount: number
}

/** SurfaceId → Handoff surface kind 投影：主画布系 → main；上下文系 → context；工作流系 → workflow。 */
export function handoffSurfaceKindFromSurfaceId(surface: string): 'main' | 'context' | 'workflow' {
  if (surface === 'workflow' || surface === 'work' || surface === 'work-free' || surface === 'deliver' || surface === 'deliver-versions' || surface === 'deliver-pack') return 'workflow'
  if (surface === 'outline' || surface === 'context-space' || surface === 'context-flow' || surface === 'context-tree' || surface === 'context-graph') return 'context'
  return 'main'
}

/** surface kind 中文标签（承接确认小卡与注入前缀共用同一口径）。 */
export function handoffSurfaceKindLabel(kind: 'main' | 'context' | 'workflow'): string {
  if (kind === 'context') return '上下文'
  if (kind === 'workflow') return '工作流'
  return '主画布'
}

/** RECEIVER-3 注入前缀纯函数：pending Handoff 快照 → 「[承接上下文] …」前缀行。
 *  fromLabel 由调用方按 fromConversationId 反查（查不到传 null）；selectionTitles 与 selectionEntityIds 一一对应。
 *  格式：[承接上下文] 从「X」切换而来；切换时现场：主画布；选中对象：A、B、C（无选中时「无」）。 */
export function buildHandoffInstructionPrefix(pack: ProjectHandoffPackV1, fromLabel: string | null, selectionTitles: readonly string[]): string {
  const fromPart = fromLabel === null ? '首次承接（无前手会话）' : `从「${fromLabel}」切换而来`
  const titles = selectionTitles.length === 0 ? '无' : selectionTitles.join('、')
  return `[承接上下文] ${fromPart}；切换时现场：${handoffSurfaceKindLabel(pack.surface.kind)}；选中对象：${titles}`
}

/** 注入 instruction：前缀行 + 用户原指令（前缀只拼 prompt 文本，0.1 不动 Runtime 的 prompt compiler）。 */
export function applyHandoffPrefixToInstruction(prefix: string, instruction: string): string {
  return `${prefix}\n${instruction}`
}

/** next-send injection 决策纯函数：pending=null（已消费或从未准备）→ null（不注入，幂等）；
 *  有未消费快照 → 前缀字符串。fromLabel/selectionTitles 由调用方按真实状态反查后传入。 */
export function resolveHandoffPrefix(pending: ProjectHandoffPackV1 | null, fromLabel: string | null, selectionTitles: readonly string[]): string | null {
  if (pending === null) return null
  return buildHandoffInstructionPrefix(pending, fromLabel, selectionTitles)
}

/** RECEIVER-6 施工现场差异（43I.2）：切换目标与当前承接的 branch/workspace 不一致时给出提醒。
 *  取值口径：branchRef 优先（施工现场的第一标识），无 branch 时回退 workspaceRef；两边都缺 → 无可对比（null，不打扰）。
 *  第一版只提醒不自动 merge/checkout（方案红线）。 */
export interface ReceiverSiteMismatch {
  readonly current: string
  readonly target: string
}

/** 对比当前承接与切换目标的工作现场：一致 / 信息不足 → null（不出提醒）；不一致 → { current, target }。 */
export function receiverSiteMismatch(active: ConnectedConversationV1 | null, target: ConnectedConversationV1 | null): ReceiverSiteMismatch | null {
  if (active === null || target === null) return null
  const siteOf = (conversation: ConnectedConversationV1): string | null => conversation.branchRef ?? conversation.workspaceRef ?? null
  const currentSite = siteOf(active)
  const targetSite = siteOf(target)
  if (currentSite === null || targetSite === null) return null
  return currentSite === targetSite ? null : { current: currentSite, target: targetSite }
}
