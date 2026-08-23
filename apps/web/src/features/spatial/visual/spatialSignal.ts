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
 */
export function resolveSpatialSignal(input: SpatialSignalInput): SpatialSignalPresentation {
  const semantic = input.semantic?.trim().toLowerCase() ?? ''
  const runtime = input.runtime ?? 'idle'
  let glyph: LcosGlythState = input.selected ? 'focus' : 'stable'

  if (matches(semantic, /candidate|explore|draft|idea|候选|探索|草稿|灵感/)) glyph = 'candidate'
  if (matches(semantic, /protect|frozen|locked|confirmed|保护|冻结|已确认|不要动/)) glyph = 'protected'
  if (runtime === 'waiting' || matches(semantic, /waiting|pending|review|待.*确认|等待|待补/)) glyph = 'waiting'
  if (runtime === 'active' || runtime === 'processing' || matches(semantic, /working|active|processing|正在|处理中/)) glyph = 'working'
  if (runtime === 'blocked' || runtime === 'failed' || matches(semantic, /blocked|failed|conflict|阻塞|失败|冲突/)) glyph = 'blocked'

  const matrixActive = glyph === 'working'
  return {
    glyph,
    matrixActive,
    segmentActive: Boolean(input.selected || glyph === 'working' || glyph === 'waiting' || glyph === 'blocked'),
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
