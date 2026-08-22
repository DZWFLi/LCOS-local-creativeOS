import type { CSSProperties } from 'react'

/** Activity texture is optional. Idle/off renders nothing, so it can be fully disabled. */
export function MatrixActivity({ active = false, density = 8, className = '' }: {
  readonly active?: boolean
  readonly density?: number
  readonly className?: string
}) {
  if (!active) return null
  const cells = Array.from({ length: Math.max(2, Math.min(18, density)) }, (_, index) => index)
  return <span className={`lcos-matrix-activity ${className}`.trim()} aria-hidden="true">
    {cells.map((index) => <i key={index} style={{ '--matrix-index': index } as CSSProperties} />)}
  </span>
}
