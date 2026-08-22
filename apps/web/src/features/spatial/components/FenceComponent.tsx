import { LightSegment } from '../visual/LightSegment'
import { LcosGlyph } from '../visual/LcosGlyph'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function FenceComponent({ element, selected = false, meta }: SurfaceComponentRenderProps) {
  return <div className={`lcos-surface-fence-body ${selected ? 'is-selected' : ''}`} data-surface-fence={element.id}>
    <LightSegment axis="horizontal" length={48} active={selected}/>
    <div className="lcos-surface-fence-label"><LcosGlyph state={selected ? 'focus' : 'stable'}/><span><strong>围栏</strong><small>{meta ?? '只组织这里的投影'}</small></span></div>
    <span className="lcos-surface-fence-corner corner-tr" aria-hidden="true" />
    <span className="lcos-surface-fence-corner corner-bl" aria-hidden="true" />
  </div>
}
