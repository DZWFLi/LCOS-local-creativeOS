import type { CSSProperties } from 'react'

export function LightSegment({ axis = 'horizontal', active = false, length = 42, className = '' }: {
  readonly axis?: 'horizontal' | 'vertical'
  readonly active?: boolean
  readonly length?: number
  readonly className?: string
}) {
  const style = (axis === 'horizontal' ? { width: length } : { height: length }) as CSSProperties
  return <i className={`lcos-light-segment axis-${axis} ${active ? 'is-active' : ''} ${className}`.trim()} style={style} aria-hidden="true" />
}
