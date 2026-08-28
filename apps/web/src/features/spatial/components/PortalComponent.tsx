import { LightSegment } from '../visual/LightSegment'
import { LcosSignalGlyph } from '../../design/DotGlyph'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const binding = element.binding
  return binding?.contextId ?? binding?.workflowId ?? binding?.entityId ?? binding?.projectViewId ?? '未绑定目标'
}

export function PortalComponent({ element, selected = false, context }: SurfaceComponentRenderProps) {
  const targetId = element.binding?.projectViewId
  return <button type="button" className={`lcos-surface-portal-body ${selected ? 'is-selected' : ''}`} data-surface-portal={element.id} disabled={!targetId} onDoubleClick={() => targetId && context?.onOpenPortal?.(targetId)}>
    <LcosSignalGlyph state={selected ? 'focus' : 'stable'}/>
    <span className="lcos-surface-portal-copy"><strong>{element.presentation?.variant || '入口'}</strong><small>{bindingLabel(element)}</small></span>
    <LightSegment axis="horizontal" length={36} active={selected}/><b aria-hidden="true">↗</b>
  </button>
}
