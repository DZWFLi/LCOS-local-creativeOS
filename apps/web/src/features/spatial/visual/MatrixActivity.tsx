import type { CSSProperties } from 'react'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

/**
 * Matrix Activity — ROG-style low-resolution dot field.
 *
 * Frozen syntax (2026-08-23): eight verbs, single base colour, semantic red
 * reserved for errors. Pose reads black-and-white; colour only disambiguates.
 * Pure CSS animation: the dot field never joins the shared rAF clock.
 */

export type MatrixVerb = 'gather' | 'spread' | 'gap' | 'flow' | 'pull' | 'break' | 'absorb' | 'emit'
export type MatrixSemantic = 'default' | 'error'

/** Activity texture is optional. Idle/off renders nothing, so it can be fully disabled. */
export function MatrixActivity({ active = false, verb = 'flow', density = 8, direction = 0, semantic = 'default', className = '' }: {
  readonly active?: boolean
  readonly verb?: MatrixVerb
  readonly density?: number
  readonly direction?: number
  readonly semantic?: MatrixSemantic
  readonly className?: string
}) {
  const reducedMotion = useReducedSpatialMotion()
  if (!active) return null
  const count = Math.max(2, Math.min(24, Math.round(density)))
  const cells = Array.from({ length: count }, (_, index) => index)
  return <span
    className={`lcos-matrix-activity verb-${verb} ${semantic === 'error' ? 'is-semantic-error' : ''} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()}
    style={{ '--matrix-direction': `${direction}deg` } as CSSProperties}
    aria-hidden="true"
  >
    {cells.map((index) => <i key={index} style={{ '--matrix-index': index } as CSSProperties} />)}
  </span>
}
