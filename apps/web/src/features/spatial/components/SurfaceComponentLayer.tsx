import { useEffect, useState } from 'react'
import type { SurfaceBounds, SurfaceElement, SurfaceKind } from '../model/surfaceElementTypes'
import { applySurfaceOps, type SurfaceOp } from '../model/surfaceOps'
import { resolveSurfaceComponent } from './surfaceComponentRegistry'
import { SurfaceFrame } from './SurfaceFrame'
import type { SurfaceComponentRenderContext, SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { applySourceChainEdit } from '../model/sourceChainOps'

export function SurfaceComponentLayer({ surface, elements, zoom, renderContext, onElementsChange }: {
  readonly surface: SurfaceKind
  readonly elements: readonly SurfaceElement[]
  readonly zoom: number
  readonly renderContext?: SurfaceComponentRenderContext
  readonly onElementsChange: (elements: SurfaceElement[]) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [alignmentGuide, setAlignmentGuide] = useState<{ readonly x?: number; readonly y?: number } | null>(null)
  const visible = elements.filter((element) => element.surface === surface)
  useEffect(() => { if (selectedId && !visible.some((element) => element.id === selectedId)) setSelectedId(null) }, [selectedId, visible])

  const commit = (op: SurfaceOp) => onElementsChange(applySurfaceOps(elements, [op]))
  const commitBounds = (element: SurfaceElement, bounds: SurfaceBounds, kind: 'move' | 'resize') => {
    commit(kind === 'move'
      ? { type: 'move', elementId: element.id, x: bounds.x, y: bounds.y }
      : { type: 'resize', elementId: element.id, w: bounds.w, h: bounds.h })
  }
  const previewAlignment = (element: SurfaceElement, bounds: SurfaceBounds | null, kind: 'move' | 'resize') => {
    if (!bounds || kind !== 'move') { setAlignmentGuide(null); return }
    const threshold = 6 / Math.max(.05, zoom)
    const ownX = [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w]
    const ownY = [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h]
    let bestX: { value: number; distance: number } | null = null
    let bestY: { value: number; distance: number } | null = null
    for (const other of visible) {
      if (other.id === element.id) continue
      for (const value of [other.bounds.x, other.bounds.x + other.bounds.w / 2, other.bounds.x + other.bounds.w]) {
        const distance = Math.min(...ownX.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestX || distance < bestX.distance)) bestX = { value, distance }
      }
      for (const value of [other.bounds.y, other.bounds.y + other.bounds.h / 2, other.bounds.y + other.bounds.h]) {
        const distance = Math.min(...ownY.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestY || distance < bestY.distance)) bestY = { value, distance }
      }
    }
    const next = bestX || bestY ? { ...(bestX ? { x: bestX.value } : {}), ...(bestY ? { y: bestY.value } : {}) } : null
    setAlignmentGuide((current) => current?.x === next?.x && current?.y === next?.y ? current : next)
  }

  return <div className="lcos-surface-component-layer" data-surface-component-layer={surface}>
    {alignmentGuide?.x !== undefined && <i className="lcos-alignment-guide axis-x" style={{ left: alignmentGuide.x }}/>} {/* x guide */}
    {alignmentGuide?.y !== undefined && <i className="lcos-alignment-guide axis-y" style={{ top: alignmentGuide.y }}/>} {/* y guide */}
    {visible.map((element) => {
      const definition = resolveSurfaceComponent(element.type)
      const Renderer = definition.renderer
      const editSourceChain = (edit: Parameters<NonNullable<SurfaceComponentRenderProps['onSourceChainEdit']>>[0]) => {
        onElementsChange(applySourceChainEdit(elements, element.id, edit))
      }
      return <SurfaceFrame
        key={element.id}
        element={element}
        definition={definition}
        zoom={zoom}
        selected={selectedId === element.id}
        onSelect={() => setSelectedId(element.id)}
        onBoundsCommit={(bounds, kind) => commitBounds(element, bounds, kind)}
        onBoundsPreview={(bounds, kind) => previewAlignment(element, bounds, kind)}
        onPresentationChange={(presentation) => onElementsChange(elements.map((item) => item.id === element.id ? { ...item, presentation } : item))}
        onRemove={() => commit({ type: 'remove-projection', elementId: element.id })}
      >
        <Renderer element={element} selected={selectedId === element.id} context={renderContext} onSourceChainEdit={editSourceChain}/>
      </SurfaceFrame>
    })}
  </div>
}
