import { useReducedSpatialMotion } from './useReducedSpatialMotion'

export function LcosGlyph({ state = 'stable', className = '' }: {
  readonly state?: 'stable' | 'focus' | 'working'
  readonly className?: string
}) {
  const reducedMotion = useReducedSpatialMotion()
  return <span className={`lcos-spatial-glyph state-${state} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()} aria-hidden="true">
    <span className="lcos-spatial-glyph-shell shell-top" />
    <span className="lcos-spatial-glyph-shell shell-right" />
    <span className="lcos-spatial-glyph-shell shell-bottom" />
    <span className="lcos-spatial-glyph-shell shell-left" />
    <span className="lcos-spatial-glyph-core"><i /><i /></span>
  </span>
}
