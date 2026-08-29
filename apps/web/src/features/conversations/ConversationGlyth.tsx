import { useEffect, useId, useRef, useState } from 'react'
import type { ConversationSessionV1 } from '@local-creative-os/contracts'
import type { BotFrame, RenderedEye } from '../spatial/visual/bloub/engine'
import { STATE_BY_ID, POSES } from '../spatial/visual/bloub/states'
import type { DotRender } from '../spatial/visual/bloub/decor'
import { createConversationGlythEngine, GLYTH_TO_BLOUB } from '../spatial/visual/glythBloub'
import { coerceGlythState, subscribeGlythClock, type LcosGlythState } from '../spatial/visual/glythMotion'
import { useReducedSpatialMotion } from '../spatial/visual/useReducedSpatialMotion'

/**
 * Wave C-2：Conversation Projection —— 对话实体上画布的第一只 Glyth 身体。
 *
 * Grammar §8：Conversation → Persistent Glyth Projection。Glyth 不是 avatar/icon/badge，
 * 而是可被选中、进入、控制、观察状态的角色身体。本组件渲染一只 bloub Glyth 作为某个
 * 「对话实体」的投影身体；七态经 GLYTH_TO_BLOUB 映射到 bloub 引擎，活动度（activityScore）
 * 驱动 Activity Decay（长期 dormant → 低饱和、安静）。
 *
 * Diegetic 化（GUI 裁决 §2.1）：状态靠身体四通道（shape/expression/color/motion）表达，
 * 组件不渲染通知徽章（.lcos-glyth-notif 被刻意排除）——这正是与 LcosGlyth 的差异。
 *
 * 取数链路：本地数据入口已存在（localCoreClient.conversations / conversationProjection），
 * 本刀只做「已有对话数据 → 画布投影」的纯呈现层；把 ConversationSessionV1 注入画布节点的
 * 编排（projectConversationEntityNodes + CanvasNodeVisual 卡片分发）在 Wave E 接入。
 */

/** 引擎比例：与 LcosGlyth 一致（viewBox 100×100、原点平移到 (50,50)）。 */
const GLYTH_SCALE = 30
/** Activity Decay dormant 阈值：activityScore < 该值 → 低饱和安静态。 */
export const DORMANT_THRESHOLD = 0.5
/** 活动度指数衰减时间常数（小时，常量名沿用 half-life 是历史误称）：score = Math.exp(-hoursSince / 24)，即 24h → e⁻¹ ≈ 0.368（并非 0.5）；DORMANT_THRESHOLD 0.5 约在 24·ln2 ≈ 16.6h 处到达。 */
const ACTIVITY_HALF_LIFE_HOURS = 24

/** 对话实体投影所需的会话字段子集（ConversationSessionV1 是其超集，可直接赋值）。 */
export interface ConversationGlythInput {
  readonly id: string
  readonly title: string
  readonly messageCount?: number
  readonly updatedAt?: string
  readonly lastOpenedAt?: string
  readonly lastRunAt?: string
  readonly lastSelectedAsControllerAt?: string
}

export type { BotFrame } from '../spatial/visual/bloub/engine'

/** @deprecated Activity recency is presentation decay only; it never means working. */
export function conversationGlythStateFromRecent(_conversation: ConversationGlythInput, _now = Date.now()): LcosGlythState {
  return 'stable'
}

/**
 * Activity Decay 分数：取会话最近的活动时间戳（updatedAt/lastOpenedAt/lastRunAt/
 * lastSelectedAsControllerAt 最近者），按指数衰减映射到 0..1。无任何时间戳时给中性 0.5。
 */
export function conversationActivityScore(conversation: ConversationGlythInput, now = Date.now()): number {
  const timestamps = [
    conversation.updatedAt,
    conversation.lastOpenedAt,
    conversation.lastRunAt,
    conversation.lastSelectedAsControllerAt,
  ].filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
  if (timestamps.length === 0) return 0.5
  const recent = Math.max(...timestamps)
  const hoursSince = Math.max(0, (now - recent) / 3_600_000)
  return Math.exp(-hoursSince / ACTIVITY_HALF_LIFE_HOURS)
}

/** 纯函数：给定三态，产出一帧静止姿态（bloub 引擎 sample 是时间的纯函数，SSR 安全）。 */
export function computeGlythFrame(state: LcosGlythState, scale = GLYTH_SCALE): BotFrame {
  const engine = createConversationGlythEngine(scale)
  const stateId = GLYTH_TO_BLOUB[state]
  engine.setState(stateId, 0)
  return engine.sample(POSES[stateId])
}

function DotNode({ dot, scale }: { dot: DotRender; scale: number }) {
  if (dot.d) {
    return <path className="lcos-glyth-dot" d={dot.d} transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${scale})`} style={{ opacity: dot.opacity }} />
  }
  return <circle className="lcos-glyth-dot" cx={dot.x} cy={dot.y} r={dot.r} style={{ opacity: dot.opacity }} />
}

function EyeNode({ eye }: { eye: RenderedEye }) {
  return <path className="lcos-glyth-eye" d={eye.d} transform={eye.matrix} style={{ opacity: eye.alpha }} />
}

export function ConversationGlyth({ conversation, state, activityScore, size = 48, className = '', label, animated = true }: {
  readonly conversation: ConversationGlythInput
  readonly state?: LcosGlythState
  readonly activityScore?: number
  readonly size?: number
  readonly className?: string
  readonly label?: string
  readonly animated?: boolean
}) {
  const scaledState = coerceGlythState(state ?? conversationGlythStateFromRecent(conversation))
  const resolvedActivity = activityScore ?? conversationActivityScore(conversation)
  const dormant = resolvedActivity < DORMANT_THRESHOLD
  const reducedMotion = useReducedSpatialMotion()
  const uid = useId()
  const engineRef = useRef<ReturnType<typeof createConversationGlythEngine> | null>(null)
  if (!engineRef.current) engineRef.current = createConversationGlythEngine(GLYTH_SCALE)
  // 初始帧：静态快照（SSR/renderToStaticMarkup 下给出非空身体 + 可读姿态）。
  const [frame, setFrame] = useState<BotFrame>(() => computeGlythFrame(scaledState))

  useEffect(() => {
    engineRef.current?.setState(GLYTH_TO_BLOUB[scaledState], performance.now() / 1000)
  }, [scaledState])

  useEffect(() => {
    if (!animated || reducedMotion) return
    const engine = engineRef.current
    if (!engine) return
    return subscribeGlythClock((seconds) => setFrame(engine.sample(seconds)))
  }, [animated, reducedMotion])

  const glyphClass = `lcos-glyth lcos-conversation-glyth state-${scaledState}${dormant ? ' is-dormant' : ''}${reducedMotion ? ' is-reduced-motion' : ''}${className ? ` ${className}` : ''}`
  return <svg className={glyphClass} data-glyth-state={scaledState} data-conversation-id={conversation.id} viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
    <defs>
      {frame.arcs.map((arc, index) => {
        const stops = arc.grad.stops
        const lastStop = stops[stops.length - 1] ?? '#fff'
        return <linearGradient key={index} id={`${uid}-arc${index}`} gradientUnits="userSpaceOnUse" x1={arc.grad.x1} y1={arc.grad.y1} x2={arc.grad.x2} y2={arc.grad.y2}>
          {stops.map((color, stopIndex) => <stop key={stopIndex} offset={stopIndex / Math.max(1, stops.length - 1)} stopColor={color ?? lastStop} />)}
        </linearGradient>
      })}
    </defs>
    <g transform="translate(50 50)">
      {frame.dotsBehind && frame.dots.length > 0 && <g className="lcos-glyth-dots is-behind" data-glyth-dots="behind">{frame.dots.map((dot, index) => <DotNode key={index} dot={dot} scale={GLYTH_SCALE} />)}</g>}
      {frame.arcs.map((arc, index) => (arc.back ? <path key={`b${index}`} className="lcos-glyth-arc-back" d={arc.back} stroke={`url(#${uid}-arc${index})`} strokeWidth={arc.width} style={{ opacity: arc.opacity }} fill="none" strokeLinecap="round" /> : null))}
      <path className="lcos-glyth-core" d={frame.bodyPath} style={{ opacity: frame.bodyAlpha }} />
      <g className="lcos-glyth-eyes">{frame.eyes.map((eye, index) => <EyeNode key={index} eye={eye} />)}</g>
      {!frame.dotsBehind && frame.dots.length > 0 && <g className="lcos-glyth-dots" data-glyth-dots="front">{frame.dots.map((dot, index) => <DotNode key={index} dot={dot} scale={GLYTH_SCALE} />)}</g>}
      {frame.arcs.map((arc, index) => (arc.front ? <path key={`f${index}`} className="lcos-glyth-arc-front" d={arc.front} stroke={`url(#${uid}-arc${index})`} strokeWidth={arc.width} style={{ opacity: arc.opacity }} fill="none" strokeLinecap="round" /> : null))}
      {frame.notch && <circle className="lcos-glyth-notch" cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} />}
    </g>
  </svg>
}

/** R2-B far semantic projection: map-pin shell + the Conversation's own living silhouette. */
export function ConversationGlythIdentityPin({ conversation, state, activityScore, label }: {
  readonly conversation: ConversationGlythInput
  readonly state?: LcosGlythState
  readonly activityScore?: number
  readonly label?: string
}) {
  return <span className="lcos-glyth-identity-pin" data-conversation-id={conversation.id} aria-label={label} role={label ? 'img' : undefined}>
    <span className="lcos-glyth-pin-stem" aria-hidden="true"/>
    <span className="lcos-glyth-pin-face" aria-hidden="true">
      <ConversationGlyth conversation={conversation} state={state} activityScore={activityScore} size={30} animated={false}/>
    </span>
  </span>
}
