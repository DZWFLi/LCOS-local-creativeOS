import { LightSegment } from '../visual/LightSegment'
import { MatrixActivity } from '../visual/MatrixActivity'
import { LcosSignalGlyph } from '../../design/DotGlyph'
import { resolveSpatialSignal } from '../visual/spatialSignal'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function RegionComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant })
  return <div className={`lcos-surface-region-body ${selected ? 'is-selected' : ''} ${signal.signalClass}`} data-surface-region={element.id} data-spatial-signal={signal.state}>
    <div className="lcos-surface-region-head"><LcosSignalGlyph state={signal.state}/><span><strong>区域</strong><small>{element.presentation?.variant ?? '共同主题 / 状态提示'}</small></span></div>
    <LightSegment axis="horizontal" length={72} active={signal.segmentActive}/>
    <MatrixActivity active={signal.matrixActive} density={10}/>
  </div>
}
