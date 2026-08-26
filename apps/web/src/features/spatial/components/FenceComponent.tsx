import { LightSegment } from '../visual/LightSegment'
import { LcosGlyph } from '../visual/LcosGlyph'
import { resolveSpatialSignal } from '../visual/spatialSignal'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function FenceComponent({ element, selected = false, meta }: SurfaceComponentRenderProps) {
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant })
  return <div className={`lcos-surface-fence-body ${selected ? 'is-selected' : ''} ${signal.signalClass}`} data-surface-fence={element.id} data-spatial-signal={signal.glyph}>
    <LightSegment axis="horizontal" length={48} active={signal.segmentActive}/>
    <div className="lcos-surface-fence-label"><LcosGlyph state={signal.glyph}/><span><strong>围栏</strong><small>{meta ?? element.presentation?.variant ?? '只组织这里的投影'}</small></span></div>
    <span className="lcos-surface-fence-corner corner-tr" aria-hidden="true" />
    <span className="lcos-surface-fence-corner corner-bl" aria-hidden="true" />
  </div>
}
