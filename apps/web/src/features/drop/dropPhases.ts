/**
 * Semantic Drop 五阶段感知语言（Wave D-2 · Grammar §14 / §15 + UX 收口 §2.2）。
 *
 * Drop 固定五阶段：
 *   1 Approaching —— 拖拽对象靠近合法目标：目标区域非常轻地活起来。
 *   2 Receptive    —— 真正命中 Drop Target：目标边界进入可接收状态（tldraw 式 hinting）。
 *   3 Accept       —— 鼠标松开前端确认接受意图：目标 recoil + 一次短促 Light Sweep。
 *   4 Commit       —— Core 真正写入成功后：光扫完整，新对象/投影 settle 到位置。
 *   5 Settle       —— 空间反馈已足够，文本甚至可不出现。
 *
 * 反馈 channel：field / motion / light / Glyth expression / optional sound。
 * Toast 只是异常/复杂说明兜底（§15：操作成功尽量由世界自己说话）。
 *
 * tldraw hinting 协议（六库调研冻结结论——只抄模式不抄码）：
 *   可投放 = 同色加粗，不换色不换 dash；overlay 独立分层；程序化 setHinted(ids)；
 *   进行中每帧重算，松手/取消清空。
 *
 * 本模块只做纯函数判定，不碰 DOM / React。命中判定本体在 semanticDrop.ts（禁动）。
 */

export type DropPhase = 'idle' | 'approaching' | 'receptive' | 'accept' | 'commit' | 'settle'

/** 接近判定阈值（px）：指针进入合法目标包围盒外扩 DROP_PHASE_NEAR_PX 内即视为 approaching。可调。 */
export const DROP_PHASE_NEAR_PX = 48

/**
 * 五阶段判定的空间输入（proximity 维度）。
 * hitTarget 由 semanticDrop 命中判定给出（elementFromPoint / [data-project-view-drop-target]），
 * nearLegalTarget 由调用方用距离阈值（DROP_PHASE_NEAR_PX）计算给出。
 */
export interface DropProximityInput {
  /** 是否命中合法 drop target（目标边界进入「可接收」状态）。 */
  readonly hitTarget: boolean
  /** 是否接近合法目标（距离阈值 DROP_PHASE_NEAR_PX 内，尚未命中）。 */
  readonly nearLegalTarget: boolean
}

/** Receptive：真正命中 Drop Target。 */
export function isReceptive(input: DropProximityInput): boolean {
  return input.hitTarget
}

/** Approaching：接近合法目标但尚未命中（不弹文案、不改变真实状态）。 */
export function isApproaching(input: DropProximityInput): boolean {
  return !input.hitTarget && input.nearLegalTarget
}

/** 由 proximity 输入映射到空间子阶段（idle / approaching / receptive）。 */
export function proximityPhase(input: DropProximityInput): Exclude<DropPhase, 'accept' | 'commit' | 'settle'> {
  if (isReceptive(input)) return 'receptive'
  if (isApproaching(input)) return 'approaching'
  return 'idle'
}

/** Commit：Core 真正写入已完成（accept 之后、settle 前后均视为已提交）。 */
export function isCommit(phase: DropPhase): boolean {
  return phase === 'commit' || phase === 'settle'
}

/**
 * 五阶段推进纯函数。
 * @param current   当前阶段。
 * @param proximity pointer 当前的空间命中/接近输入。
 * @param committed 是否已确认写入成功（外部 onDrop 成功后置 true，驱动 accept→commit→settle）。
 *
 * 规则：
 *   - committed 时：accept→commit→settle 单向推进，已到 settle 则停留。
 *   - 未 committed 时：accept/commit/settle 不回退；空间子阶段由 proximity 决定。
 *   - 松手未命中（proximity 全 false）回到 idle（tldraw：松手/取消清空）。
 */
export function advanceDropPhase(
  current: DropPhase,
  proximity: DropProximityInput,
  committed: boolean,
): DropPhase {
  if (committed) {
    if (current === 'accept') return 'commit'
    if (current === 'commit') return 'settle'
    return current
  }
  if (current === 'accept' || current === 'commit' || current === 'settle') return current
  return proximityPhase(proximity)
}