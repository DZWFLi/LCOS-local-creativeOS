import { useState } from 'react'
import type { SurfaceBounds, SurfaceComponentType, SurfaceElement, SurfaceKind } from '../model/surfaceElementTypes'
import { surfaceComponentsFor } from '../model/surfaceComponentCatalog'
import { placeSurfaceComponent, regionBoundsForSelection } from '../model/surfaceGeometry'
import { applySurfaceOp } from '../model/surfaceOps'

let fallbackId = 0
function createId(type: SurfaceComponentType) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `surface:${type}:${crypto.randomUUID()}`
  fallbackId += 1
  return `surface:${type}:${Date.now().toString(36)}:${fallbackId}`
}

export function SurfaceComponentShelf({ projectId, surface, elements, selectionBounds, viewportOrigin, onElementsChange }: {
  readonly projectId: string
  readonly surface: SurfaceKind
  readonly elements: readonly SurfaceElement[]
  readonly selectionBounds?: SurfaceBounds | null
  readonly viewportOrigin: { readonly x: number; readonly y: number }
  readonly onElementsChange: (elements: SurfaceElement[]) => void
}) {
  const [open, setOpen] = useState(false)
  const options = surfaceComponentsFor(surface, true)
  const create = (type: SurfaceComponentType) => {
    const definition = options.find((item) => item.type === type)
    if (!definition) return
    const bounds = (type === 'fence' || type === 'region') && selectionBounds
      ? regionBoundsForSelection(selectionBounds, definition.minSize)
      : placeSurfaceComponent({ size: definition.minSize, selection: selectionBounds, viewportOrigin, existing: elements })
    const component: SurfaceElement = { id: createId(type), projectId, surface, type, bounds, presentation: { zIndex: type === 'fence' || type === 'region' ? 1 : 4 } }
    onElementsChange(applySurfaceOp(elements, { type: 'create-component', component }))
    setOpen(false)
  }
  return <div className={`lcos-surface-component-shelf ${open ? 'is-open' : ''}`} data-surface-component-shelf={surface}>
    <button type="button" className="lcos-surface-component-shelf-toggle" aria-expanded={open} aria-label="添加现场组件" title="添加现场组件" onClick={() => setOpen((current) => !current)}>＋</button>
    {open && <div className="lcos-surface-component-shelf-menu" role="menu">
      <header><strong>现场组件</strong><small>只改变这里怎么工作</small></header>
      {options.map((entry) => <button key={entry.type} type="button" role="menuitem" onClick={() => create(entry.type)}><span>{entry.label}</span><small>{entry.description}</small></button>)}
    </div>}
  </div>
}
