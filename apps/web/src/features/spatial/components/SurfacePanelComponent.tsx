import { LightSegment } from '../visual/LightSegment'
import { MatrixActivity } from '../visual/MatrixActivity'
import { LcosGlyph } from '../visual/LcosGlyph'
import { surfaceComponentContract } from '../model/surfaceComponentCatalog'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { resolveSpatialSignal } from '../visual/spatialSignal'

export function SurfacePanelComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  const contract = surfaceComponentContract(element.type)
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant })
  const binding = element.binding
  const bindingText = binding
    ? Object.entries(binding).map(([kind, id]) => `${kind.replace(/Id$/, '')}: ${id}`).join(' · ')
    : '等待绑定真实项目对象'
  return <div className={`lcos-surface-panel-body panel-${element.type} ${selected ? 'is-selected' : ''} ${signal.signalClass}`} data-surface-panel={element.type} data-spatial-signal={signal.glyph}>
    <header><LcosGlyph state={signal.glyph}/><span><strong>{contract.label}</strong><small>{contract.description}</small></span><LightSegment axis="horizontal" active={signal.segmentActive} length={44}/></header>
    <div className="lcos-surface-panel-content">
      <p>{bindingText}</p>
      <span>{element.presentation?.variant ?? (contract.capabilities.lens ? 'Lens · 可替换当前内部表达' : 'Presentation component')}</span>
    </div>
    <MatrixActivity active={signal.matrixActive} density={12}/>
  </div>
}
