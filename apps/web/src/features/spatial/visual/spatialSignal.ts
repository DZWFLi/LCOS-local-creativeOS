import type { LcosSignalState } from '../../design/DotGlyph'
import type { SurfaceElement } from '../model/surfaceElementTypes'

/**
 * Presentation-only spatial signal vocabulary for ordinary objects/components.
 * Glyth is reserved for Conversation identity. These states drive the tiny
 * 16×16 LCOS system signal plus Matrix / LightSegment; they never create truth.
 */
export type SpatialRuntimeSignal = 'idle' | 'active' | 'processing' | 'waiting' | 'blocked' | 'failed' | 'complete'

export interface SpatialSignalInput {
  readonly selected?: boolean
  /** One-degree relation attention. Transient Presentation input only. */
  readonly neighborSelected?: boolean
  readonly semantic?: string
  readonly runtime?: SpatialRuntimeSignal
}

export interface SpatialSignalPresentation {
  readonly state: LcosSignalState
  readonly matrixActive: boolean
  readonly segmentActive: boolean
  readonly signalClass: string
}

const matches = (value: string, pattern: RegExp) => pattern.test(value)

/** Resolve already-known semantic/runtime state into native system feedback. */
export function resolveSpatialSignal(input: SpatialSignalInput): SpatialSignalPresentation {
  const semantic = input.semantic?.trim().toLowerCase() ?? ''
  const runtime = input.runtime ?? 'idle'
  let state: LcosSignalState = 'stable'

  if (matches(semantic, /waiting|pending|review|待.*确认|等待|待补/)) state = 'pending'
  if (matches(semantic, /candidate|explore|draft|idea|候选|探索|草稿|灵感/)) state = 'working'
  if (runtime === 'waiting') state = 'pending'
  if (matches(semantic, /working|active|processing|正在|处理中/)) state = 'working'
  if (runtime === 'active' || runtime === 'processing') state = 'working'
  if (matches(semantic, /absorb|reading|receive|import|接收|读取|导入|吸收/)) state = 'receiving'
  if (matches(semantic, /output|send|emit|输出|发送|生成完毕/)) state = 'sending'
  if (matches(semantic, /confirmed|done|complete|已确认|已完成/) || runtime === 'complete') state = 'kept'
  if (matches(semantic, /blocked|failed|conflict|error|阻塞|失败|冲突|出错/)) state = 'failed'
  if (runtime === 'blocked' || runtime === 'failed') state = 'failed'

  const matrixActive = state !== 'failed'
    && (state === 'working' || state === 'receiving' || state === 'sending' || Boolean(input.neighborSelected))
  return {
    state,
    matrixActive,
    segmentActive: Boolean(input.selected || state !== 'stable'),
    signalClass: `signal-${state}`,
  }
}

export function shouldShowSignal(signal: SpatialSignalPresentation): boolean {
  return signal.state !== 'stable'
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
