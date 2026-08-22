import type { CSSProperties } from 'react'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

/** Activity texture is optional. Idle/off renders nothing, so it can be fully disabled. */
export function MatrixActivity({ active = false, density = 8, className = '' }: {
  readonly active?: boolean
  readonly density?: number
  readonly className?: string
}) {
  const reducedMotion = useReducedSpatialMotion()
  if (!active) return null
  const cells = Array.from({ length: Math.max(2, Math.min(18, density)) }, (_, index) => index)
  return <span className={`lcos-matrix-activity ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()} aria-hidden="true">
    {cells.map((index) => <i key={index} style={{ '--matrix-index': index } as CSSProperties} />)}
  </span>
}
