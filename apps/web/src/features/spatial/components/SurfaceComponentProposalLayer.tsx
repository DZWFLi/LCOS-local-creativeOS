import { resolveSurfaceComponent } from './surfaceComponentRegistry'
import type { SurfaceComponentRenderContext } from './surfaceComponentTypes'
import type { SurfaceElement, SurfaceKind } from '../model/surfaceElementTypes'

export function SurfaceComponentProposalLayer({ surface, elements, renderContext }: {
  readonly surface: SurfaceKind
  readonly elements: readonly SurfaceElement[]
  readonly renderContext?: SurfaceComponentRenderContext
}) {
  return <div className="lcos-surface-component-proposal-layer" aria-label="Agent 布局预览">
    {elements.filter((element) => element.surface === surface).map((element) => {
      const Renderer = resolveSurfaceComponent(element.type).renderer
      return <div key={element.id} className="lcos-surface-component-proposal" style={{ left: element.bounds.x, top: element.bounds.y, width: element.bounds.w, height: element.bounds.h }}>
        <Renderer element={element} context={renderContext}/><span className="lcos-surface-component-proposal-label">Agent 建议</span>
      </div>
    })}
  </div>
}
