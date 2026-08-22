import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  const [dragPreview, setDragPreview] = useState<{ readonly type: SurfaceComponentType; readonly label: string; readonly x: number; readonly y: number; readonly valid: boolean } | null>(null)
  const closeTimer = useRef<number | null>(null)
  const cleanupDrag = useRef<(() => void) | null>(null)
  const options = surfaceComponentsFor(surface, true)
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    cleanupDrag.current?.()
  }, [])

  const create = (type: SurfaceComponentType, dropOrigin?: { readonly x: number; readonly y: number }) => {
    const definition = options.find((item) => item.type === type)
    if (!definition) return
    const bounds = (type === 'fence' || type === 'region') && selectionBounds
      ? regionBoundsForSelection(selectionBounds, definition.minSize)
      : dropOrigin
        ? { x: dropOrigin.x - definition.minSize.w / 2, y: dropOrigin.y - definition.minSize.h / 2, ...definition.minSize }
      : placeSurfaceComponent({ size: definition.minSize, selection: selectionBounds, viewportOrigin, existing: elements })
    const component: SurfaceElement = { id: createId(type), projectId, surface, type, bounds, presentation: { zIndex: type === 'fence' || type === 'region' ? 1 : 4 } }
    onElementsChange(applySurfaceOp(elements, { type: 'create-component', component }))
    setOpen(false)
  }

  const worldPointAt = (clientX: number, clientY: number) => {
    const canvas = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-spatial-canvas="true"]') ?? null
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const zoom = Math.max(.05, Number(canvas.dataset.cameraZoom) || 1)
    const cameraX = Number(canvas.dataset.cameraX) || 0
    const cameraY = Number(canvas.dataset.cameraY) || 0
    return { x: (clientX - rect.left - cameraX) / zoom, y: (clientY - rect.top - cameraY) / zoom }
  }

  const beginDrag = (entry: (typeof options)[number], event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    cleanupDrag.current?.()
    const pointerId = event.pointerId
    const start = { x: event.clientX, y: event.clientY }
    let moved = false
    const update = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return
      if (!moved && Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) > 4) moved = true
      if (!moved) return
      pointer.preventDefault()
      setDragPreview({ type: entry.type, label: entry.label, x: pointer.clientX, y: pointer.clientY, valid: worldPointAt(pointer.clientX, pointer.clientY) !== null })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', update, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', escape, true)
      cleanupDrag.current = null
      setDragPreview(null)
    }
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return
      const point = moved ? worldPointAt(pointer.clientX, pointer.clientY) : null
      cleanup()
      if (point) create(entry.type, point)
    }
    const cancel = (pointer: PointerEvent) => { if (pointer.pointerId === pointerId) cleanup() }
    const escape = (keyboard: KeyboardEvent) => { if (keyboard.key === 'Escape') cleanup() }
    cleanupDrag.current = cleanup
    window.addEventListener('pointermove', update, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', escape, true)
  }

  const keepOpen = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setOpen(true)
  }
  const scheduleClose = () => {
    if (cleanupDrag.current) return
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 180)
  }

  return <div className={`lcos-surface-component-shelf ${open ? 'is-open' : ''}`} data-surface-component-shelf={surface} onPointerEnter={keepOpen} onPointerLeave={scheduleClose} onFocusCapture={keepOpen} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose() }}>
    <button type="button" className="lcos-surface-component-shelf-toggle" aria-expanded={open} aria-label="添加现场组件" title="添加现场组件" onClick={() => setOpen((current) => !current)}>＋</button>
    {open && <div className="lcos-surface-component-shelf-menu" role="menu">
      <header><strong>现场组件</strong><small>拖到画布；键盘 Enter 在当前视野创建</small></header>
      {options.map((entry) => <button key={entry.type} type="button" role="menuitem" draggable={false} onPointerDown={(event) => beginDrag(entry, event)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); create(entry.type) } }}><span>{entry.label}</span><small>{entry.description}</small></button>)}
    </div>}
    {dragPreview && <div className={`lcos-surface-component-drag-ghost ${dragPreview.valid ? 'is-valid' : ''}`} style={{ left: dragPreview.x, top: dragPreview.y }} aria-hidden="true"><span>＋</span><strong>{dragPreview.label}</strong><small>{dragPreview.valid ? '松开放置' : '拖到画布'}</small></div>}
  </div>
}
