import { useReducedSpatialMotion } from './useReducedSpatialMotion'

export type LcosGlyphState = 'stable' | 'focus' | 'working' | 'waiting' | 'blocked' | 'protected' | 'candidate'

export function LcosGlyph({ state = 'stable', className = '' }: {
  readonly state?: LcosGlyphState
  readonly className?: string
}) {
  const reducedMotion = useReducedSpatialMotion()
  return <span className={`lcos-spatial-glyph state-${state} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()} data-glyph-state={state} aria-hidden="true">
    <span className="lcos-spatial-glyph-shell shell-top" />
    <span className="lcos-spatial-glyph-shell shell-right" />
    <span className="lcos-spatial-glyph-shell shell-bottom" />
    <span className="lcos-spatial-glyph-shell shell-left" />
    <span className="lcos-spatial-glyph-core"><span className="lcos-spatial-glyph-eyes"><i /><i /></span></span>
  </span>
}
