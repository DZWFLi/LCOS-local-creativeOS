import { useEffect, useState } from 'react'
import type { SurfaceBounds, SurfaceElement, SurfaceKind } from '../model/surfaceElementTypes'
import { applySurfaceOps, type SurfaceOp } from '../model/surfaceOps'
import { resolveSurfaceComponent } from './surfaceComponentRegistry'
import { SurfaceFrame } from './SurfaceFrame'

export function SurfaceComponentLayer({ surface, elements, zoom, onElementsChange }: {
  readonly surface: SurfaceKind
  readonly elements: readonly SurfaceElement[]
  readonly zoom: number
  readonly onElementsChange: (elements: SurfaceElement[]) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = elements.filter((element) => element.surface === surface)
  useEffect(() => { if (selectedId && !visible.some((element) => element.id === selectedId)) setSelectedId(null) }, [selectedId, visible])

  const commit = (op: SurfaceOp) => onElementsChange(applySurfaceOps(elements, [op]))
  const commitBounds = (element: SurfaceElement, bounds: SurfaceBounds, kind: 'move' | 'resize') => {
    commit(kind === 'move'
      ? { type: 'move', elementId: element.id, x: bounds.x, y: bounds.y }
      : { type: 'resize', elementId: element.id, w: bounds.w, h: bounds.h })
  }

  return <div className="lcos-surface-component-layer" data-surface-component-layer={surface}>
    {visible.map((element) => {
      const definition = resolveSurfaceComponent(element.type)
      const Renderer = definition.renderer
      return <SurfaceFrame
        key={element.id}
        element={element}
        definition={definition}
        zoom={zoom}
        selected={selectedId === element.id}
        onSelect={() => setSelectedId(element.id)}
        onBoundsCommit={(bounds, kind) => commitBounds(element, bounds, kind)}
        onPresentationChange={(presentation) => onElementsChange(elements.map((item) => item.id === element.id ? { ...item, presentation } : item))}
        onRemove={() => commit({ type: 'remove-projection', elementId: element.id })}
      >
        <Renderer element={element} selected={selectedId === element.id}/>
      </SurfaceFrame>
    })}
  </div>
}
