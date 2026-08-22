import { LightSegment } from '../visual/LightSegment'
import { LcosGlyph } from '../visual/LcosGlyph'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const binding = element.binding
  return binding?.contextId ?? binding?.workflowId ?? binding?.entityId ?? binding?.projectViewId ?? '未绑定目标'
}

export function PortalComponent({ element, selected = false }: SurfaceComponentRenderProps) {
  return <div className={`lcos-surface-portal-body ${selected ? 'is-selected' : ''}`} data-surface-portal={element.id}>
    <LcosGlyph state={selected ? 'focus' : 'stable'}/>
    <span className="lcos-surface-portal-copy"><strong>入口</strong><small>{bindingLabel(element)}</small></span>
    <LightSegment axis="horizontal" length={36} active={selected}/><b aria-hidden="true">↗</b>
  </div>
}
