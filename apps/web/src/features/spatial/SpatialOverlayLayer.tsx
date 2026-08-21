import type { ReactNode } from 'react'

export function SpatialOverlayLayer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`lcos-spatial-overlay-layer ${className}`.trim()}>{children}</div>
}
