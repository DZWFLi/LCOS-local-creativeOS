/**
 * LCOS Glyth ↔ bloub 引擎适配层。
 *
 * bloub（vendored 自 jeremy-prt/bloub，MIT；x.ai Grok bot 头像 SVG 复刻）提供
 * 无时钟的 BotEngine：sample(t) 是时间的纯函数，setState/setLook 都是带时间戳
 * 的 setter。本文件只做三件事：
 * - 把 LCOS 的七个语义态映射到 bloub 的状态目录（冻结决策，见 GLYTH_TO_BLOUB）；
 * - 从 bloub 状态定义里取形态过渡时长（confirm 契约的计时依据）；
 * - 把共享指针位置翻译成引擎的注视目标 Look。
 */
import { BotEngine, type BotFrame, type Look } from './bloub/engine'
import { SHAPE_BY_ID, type ShapeId } from './bloub/skins'
import { STATE_BY_ID, type StateId } from './bloub/states'
import type { LcosGlythState } from './glythMotion'

/**
 * 七态 → bloub 状态（冻结决策 2026-08-25）：
 * stable→idle（呼吸眨眼+视线漂移）、working→thinking（三点思考脉冲）、
 * waiting→notify（通知徽章+视线避开）、error→alert（振动的"!"字形）、
 * confirm→wink（单眼闭合）、absorb→comet（坍缩成点+彗尾）、output→burst（爆散粒子+重组）。
 */
export const GLYTH_TO_BLOUB: Record<LcosGlythState, StateId> = {
  stable: 'idle',
  working: 'thinking',
  waiting: 'notify',
  error: 'alert',
  confirm: 'wink',
  absorb: 'comet',
  output: 'burst',
}

/** 各语义态的形态过渡时长（秒），取自 bloub STATE_BY_ID 的 morph。 */
export function glythStateDuration(state: LcosGlythState): number {
  return STATE_BY_ID.get(GLYTH_TO_BLOUB[state])!.morph
}

/** 新建 LCOS 用的 bloub 引擎：idle 起步，不带自定义形状/表情（引擎原样形态）。 */
export function createGlythEngine(scale: number): BotEngine {
  return new BotEngine(scale, 'idle')
}

/**
 * Conversation 物种形态（Grammar S8.2 四通道：Shape -> identity / durable role）。
 * 水滴形（goutte）：对话是流入并凝结的信息，尖顶朝上与消息流语义契合；
 * 与 Capture Float / 节点信号 sprite 的默认 cercle 圆形拉开身份区分——
 * 形状取自 bloub 既有 SHAPES 库（S8.1 冻结：不自行再造形态，LCOS 只做选择）。
 */
export const CONVERSATION_GLYTH_SHAPE: ShapeId = 'goutte'

/** Conversation 物种引擎：goutte 轮廓 + idle 起步（状态映射与通用引擎一致）。 */
export function createConversationGlythEngine(scale: number): BotEngine {
  return new BotEngine(scale, 'idle', SHAPE_BY_ID.get(CONVERSATION_GLYTH_SHAPE)?.radii ?? null)
}

const clampUnit = (value: number) => Math.min(1, Math.max(-1, value))

/**
 * 把指针位置翻译成引擎注视目标。
 *
 * - yaw/pitch 是绝对方向（度）：yaw 以右为正；屏幕 y 向下而 bloub 的 pitch 以
 *   向上为正，所以对 dy 取负。
 * - mix=1 表示外部完全接管注视方向；wander=0 熄灭自动漂移——有指针时不漂移，
 *   这是 bloub 引擎 Look 注释里的原语义（两者叠加会显得"在找指针却永远找不到"）。
 * - 距离用 reach 截断归一化到 -1..1（超出 reach 的按比例压缩到边界），调用方传
 *   reach = max(60, 元素宽×3)；默认 60 即最小 reach。
 */
export function pointerToLook(
  pointer: { x: number; y: number },
  center: { x: number; y: number },
  reach = 60
): Look {
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  const length = Math.hypot(dx, dy)
  const scale = length > reach ? reach / length : 1
  return {
    yaw: clampUnit((dx * scale) / reach) * 38,
    // 屏幕以 y 向下、bloub pitch 以向上为正，所以取负；+0 把 -0 归一成 +0
    pitch: -clampUnit((dy * scale) / reach) * 26 + 0,
    mix: 1,
    spin: 0,
    wander: 0,
  }
}

export type { BotEngine, BotFrame, Look } from './bloub/engine'
export type { StateId } from './bloub/states'
