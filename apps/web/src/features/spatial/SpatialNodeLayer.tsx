import type { ReactNode } from 'react'

export function SpatialNodeLayer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`lcos-spatial-node-layer ${className}`.trim()}>{children}</div>
}
