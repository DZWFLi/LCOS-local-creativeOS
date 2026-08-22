import { LightSegment } from '../visual/LightSegment'
import { MatrixActivity } from '../visual/MatrixActivity'
import { LcosGlyph } from '../visual/LcosGlyph'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function RegionComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  return <div className={`lcos-surface-region-body ${selected ? 'is-selected' : ''}`} data-surface-region={element.id}>
    <div className="lcos-surface-region-head"><LcosGlyph state={selected ? 'focus' : 'stable'}/><span><strong>语境区</strong><small>{element.presentation?.variant ?? '共同语境 / 状态场'}</small></span></div>
    <LightSegment axis="horizontal" length={72} active={selected}/>
    <MatrixActivity active={selected} density={10}/>
  </div>
}
