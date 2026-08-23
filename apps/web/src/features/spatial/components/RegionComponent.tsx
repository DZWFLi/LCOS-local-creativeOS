import { LightSegment } from '../visual/LightSegment'
import { MatrixActivity } from '../visual/MatrixActivity'
import { LcosGlyth } from '../visual/LcosGlyth'
import { resolveSpatialSignal } from '../visual/spatialSignal'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function RegionComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant })
  return <div className={`lcos-surface-region-body ${selected ? 'is-selected' : ''} ${signal.signalClass}`} data-surface-region={element.id} data-spatial-signal={signal.glyph}>
    <div className="lcos-surface-region-head"><LcosGlyth state={signal.glyph}/><span><strong>区域</strong><small>{element.presentation?.variant ?? '共同主题 / 状态提示'}</small></span></div>
    <LightSegment axis="horizontal" length={72} active={signal.segmentActive}/>
    <MatrixActivity active={signal.matrixActive} density={10}/>
  </div>
}
