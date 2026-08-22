import { LightSegment } from '../visual/LightSegment'
import { MatrixActivity } from '../visual/MatrixActivity'
import { LcosGlyph } from '../visual/LcosGlyph'
import { surfaceComponentContract } from '../model/surfaceComponentCatalog'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

export function SurfacePanelComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  const contract = surfaceComponentContract(element.type)
  const activity = element.type === 'workbench' || element.type === 'review'
  const binding = element.binding
  const bindingText = binding
    ? Object.entries(binding).map(([kind, id]) => `${kind.replace(/Id$/, '')}: ${id}`).join(' · ')
    : '等待绑定真实项目对象'
  return <div className={`lcos-surface-panel-body panel-${element.type} ${selected ? 'is-selected' : ''}`} data-surface-panel={element.type}>
    <header><LcosGlyph state={selected ? 'focus' : activity ? 'working' : 'stable'}/><span><strong>{contract.label}</strong><small>{contract.description}</small></span><LightSegment axis="horizontal" active={selected} length={44}/></header>
    <div className="lcos-surface-panel-content">
      <p>{bindingText}</p>
      <span>{element.presentation?.variant ?? (contract.capabilities.lens ? 'Lens · 可替换当前内部表达' : 'Presentation component')}</span>
    </div>
    <MatrixActivity active={activity && selected} density={12}/>
  </div>
}
