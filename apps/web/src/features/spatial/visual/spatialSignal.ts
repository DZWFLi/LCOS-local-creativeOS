import type { LcosGlythState } from './LcosGlyth'
import type { SurfaceElement } from '../model/surfaceElementTypes'

/**
 * §9 触发表（感知层规划 · 冻结版 · 施工看板）
 *
 * Edge 默认：opacity 极低或仅关键 edge 可见（发丝感）。
 *   增强条件：Select / Hover with intent / Focus / Search handoff / Run /
 *   Agent rearrange / Relationship lens。
 *   （已接线：edge 两端任一节点在 selectedIds → 增强；
 *     Focus / Search handoff 预留上报，未接。）
 *
 * Matrix 默认永远 off。触发 ON：
 *   - 选中局部 ON —— 选中节点的一度关系邻节点（neighborSelected 输入，已接线）
 *   - Focus 目标周围 ON —— useSpatialFocusRequest 目前 camera-only、无视觉回调（预留上报）
 *   - Search handoff 目标 ON（预留上报）
 *   - Agent arrange preview 涉及对象 ON（预留上报）
 *   - Run 真正执行对象 ON —— runtime processing / absorb / output 既有链路
 *   - error 局部语义红 —— 由 error glyph（Glyth）表达，matrix 不亮（测试冻结行为）
 *
 * Segment 默认 off/dim：idle 只亮两锚点（LightSegment 冻结语法，现状保持）；
 *   运行时才 flow / progress / complete；selected 只亮骨架（segmentActive）。
 */

export type SpatialRuntimeSignal = 'idle' | 'active' | 'processing' | 'waiting' | 'blocked' | 'failed' | 'complete'

export interface SpatialSignalInput {
  readonly selected?: boolean
  /** §9「选中局部 ON」：该对象是任一选中节点的一度关系邻节点（edge 直连）。瞬态输入，不持久化。 */
  readonly neighborSelected?: boolean
  readonly semantic?: string
  readonly runtime?: SpatialRuntimeSignal
}

export interface SpatialSignalPresentation {
  readonly glyph: LcosGlythState
  readonly matrixActive: boolean
  readonly segmentActive: boolean
  readonly signalClass: string
}

const matches = (value: string, pattern: RegExp) => pattern.test(value)

/**
 * Presentation-only signal resolver. It interprets an already known semantic /
 * runtime state; it never infers or persists Project Truth.
 *
 * Selection is a transient input: it lights the segment skeleton but never
 * becomes a persistent Glyth pose (rarity rule: stable bodies stay quiet).
 * Weaker signals are applied first, stronger ones override them.
 */
export function resolveSpatialSignal(input: SpatialSignalInput): SpatialSignalPresentation {
  const semantic = input.semantic?.trim().toLowerCase() ?? ''
  const runtime = input.runtime ?? 'idle'
  let glyph: LcosGlythState = 'stable'

  if (matches(semantic, /waiting|pending|review|待.*确认|等待|待补/)) glyph = 'waiting'
  if (matches(semantic, /candidate|explore|draft|idea|候选|探索|草稿|灵感/)) glyph = 'working'
  if (runtime === 'waiting') glyph = 'waiting'
  if (matches(semantic, /working|active|processing|正在|处理中/)) glyph = 'working'
  if (runtime === 'active' || runtime === 'processing') glyph = 'working'
  if (matches(semantic, /absorb|reading|receive|import|接收|读取|导入|吸收/)) glyph = 'absorb'
  if (matches(semantic, /output|send|emit|输出|发送|生成完毕/)) glyph = 'output'
  if (matches(semantic, /confirmed|done|complete|已确认|已完成/) || runtime === 'complete') glyph = 'confirm'
  if (matches(semantic, /blocked|failed|conflict|error|阻塞|失败|冲突|出错/)) glyph = 'error'
  if (runtime === 'blocked' || runtime === 'failed') glyph = 'error'

  // §9 触发表：Matrix 默认 off；error 局部语义红走 glyph，不点亮 activity 点阵。
  const matrixActive = glyph !== 'error'
    && (glyph === 'working' || glyph === 'absorb' || glyph === 'output' || Boolean(input.neighborSelected))
  return {
    glyph,
    matrixActive,
    segmentActive: Boolean(input.selected || glyph !== 'stable'),
    signalClass: `signal-${glyph}`,
  }
}

/** Glyth is semantic punctuation: omit it when there is nothing meaningful to say. */
export function shouldShowGlyth(signal: SpatialSignalPresentation): boolean {
  return signal.glyph !== 'stable'
}

/**
 * Returns only explicit Region presentation semantics for one Project View.
 * Geometry overlap is deliberately ignored: moving across a Region must not
 * silently invent membership or mutate the object's meaning.
 */
export function boundRegionSemanticForView(elements: readonly SurfaceElement[], projectViewId: string): string | undefined {
  const variants = elements.flatMap((element) => {
    if (element.type !== 'region') return []
    const ids = [element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])]
    if (!ids.includes(projectViewId)) return []
    const variant = element.presentation?.variant?.trim()
    return variant ? [variant] : []
  })
  return variants.length ? [...new Set(variants)].join(' · ') : undefined
}