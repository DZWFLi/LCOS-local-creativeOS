import type { LcosGlythState } from './LcosGlyth'
import type { SurfaceElement } from '../model/surfaceElementTypes'

export type SpatialRuntimeSignal = 'idle' | 'active' | 'processing' | 'waiting' | 'blocked' | 'failed' | 'complete'

export interface SpatialSignalInput {
  readonly selected?: boolean
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

  const matrixActive = glyph === 'working' || glyph === 'absorb' || glyph === 'output'
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
