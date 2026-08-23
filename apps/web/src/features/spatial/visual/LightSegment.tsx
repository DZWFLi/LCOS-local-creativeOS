import type { CSSProperties } from 'react'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

/**
 * Light Segment — Nothing-style discrete bar segments (seven-segment digital rhythm).
 *
 * Frozen syntax (2026-08-23):
 * - Progress   = segments light up one by one (`mode="progress"` + `progress`).
 * - Checkpoint = one fixed segment stays solid until resolved (`mode="checkpoint"` + `checkpointIndex`).
 * - Direction  = lighting order carries flow (`mode="flow"`).
 * - Idle       = dark by default, only two anchor segments stay faintly lit.
 *
 * The segment count adapts to the requested length so bars stay legibly chunky.
 */

export type LightSegmentMode = 'static' | 'progress' | 'checkpoint' | 'flow'
export type LightSegmentSemantic = 'default' | 'error'

export function LightSegment({ axis = 'horizontal', active = false, length = 42, segments, mode = 'static', progress, checkpointIndex, semantic = 'default', className = '' }: {
  readonly axis?: 'horizontal' | 'vertical'
  readonly active?: boolean
  readonly length?: number
  readonly segments?: number
  readonly mode?: LightSegmentMode
  readonly progress?: number
  readonly checkpointIndex?: number
  readonly semantic?: LightSegmentSemantic
  readonly className?: string
}) {
  const reducedMotion = useReducedSpatialMotion()
  const requested = segments ?? Math.max(3, Math.round(length / 9))
  const count = Math.max(2, Math.min(16, Math.round(requested)))
  const ratio = mode === 'progress' && typeof progress === 'number' ? Math.min(1, Math.max(0, progress)) : null
  const litCount = ratio === null ? null : Math.round(ratio * count)
  const checkpoint = mode === 'checkpoint' ? Math.min(count - 1, Math.max(0, Math.round(checkpointIndex ?? Math.floor(count / 2)))) : null
  const style = (axis === 'horizontal' ? { width: length } : { height: length }) as CSSProperties

  const cells = []
  for (let index = 0; index < count; index += 1) {
    const lit = litCount !== null
      ? index < litCount
      : checkpoint !== null
        ? index === checkpoint
        : active || index < 2
    cells.push(<i key={index} className={lit ? 'is-lit' : ''} style={{ '--segment-index': index } as CSSProperties} />)
  }

  return <span
    className={`lcos-light-segment axis-${axis} mode-${mode} ${active ? 'is-active' : ''} ${semantic === 'error' ? 'is-semantic-error' : ''} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()}
    style={style}
    aria-hidden="true"
  >{cells}</span>
}
