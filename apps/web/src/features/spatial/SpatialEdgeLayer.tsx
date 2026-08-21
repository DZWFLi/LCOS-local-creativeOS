import type { ReactNode } from 'react'
import type { SpatialBounds } from './spatialTypes'

interface Props {
  bounds: SpatialBounds
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function SpatialEdgeLayer({ bounds, children, className = '', ariaLabel }: Props) {
  return <svg
    className={`lcos-spatial-edge-layer ${className}`.trim()}
    aria-label={ariaLabel}
    viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
    preserveAspectRatio="none"
    style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
  >{children}</svg>
}
