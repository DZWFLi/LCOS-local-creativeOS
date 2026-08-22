import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { SurfaceBounds, SurfaceElement } from '../model/surfaceElementTypes'
import type { SurfaceComponentDefinition } from './surfaceComponentRegistry'
import { useReducedSpatialMotion } from '../visual/useReducedSpatialMotion'

interface Props {
  readonly element: SurfaceElement
  readonly definition: SurfaceComponentDefinition
  readonly zoom: number
  readonly selected: boolean
  readonly onSelect: () => void
  readonly onBoundsCommit: (bounds: SurfaceBounds, kind: 'move' | 'resize') => void
  readonly onBoundsPreview?: (bounds: SurfaceBounds | null, kind: 'move' | 'resize') => void
  readonly onPresentationChange: (presentation: SurfaceElement['presentation']) => void
  readonly onRemove: () => void
  readonly showPin?: boolean
  readonly children: ReactNode
}

type Interaction = { readonly kind: 'move' | 'resize'; readonly pointerId: number; readonly clientX: number; readonly clientY: number; readonly bounds: SurfaceBounds }

export function SurfaceFrame({ element, definition, zoom, selected, onSelect, onBoundsCommit, onBoundsPreview, onPresentationChange, onRemove, showPin = true, children }: Props) {
  const reducedMotion = useReducedSpatialMotion()
  const [previewBounds, setPreviewBounds] = useState<SurfaceBounds | null>(null)
  const latestBounds = useRef(element.bounds)
  const cleanupRef = useRef<(() => void) | null>(null)
  const bounds = previewBounds ?? element.bounds
  const pinned = Boolean(element.presentation?.pinned)
  const collapsed = Boolean(element.presentation?.collapsed)

  useEffect(() => { if (!previewBounds) latestBounds.current = element.bounds }, [element.bounds, previewBounds])
  useEffect(() => () => cleanupRef.current?.(), [])

  const begin = (kind: Interaction['kind'], event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || pinned) return
    if ((kind === 'move' && !definition.movable) || (kind === 'resize' && !definition.resizable)) return
    event.preventDefault(); event.stopPropagation(); onSelect()
    const interaction: Interaction = { kind, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, bounds: element.bounds }
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== interaction.pointerId) return
      const dx = (pointer.clientX - interaction.clientX) / Math.max(.05, zoom)
      const dy = (pointer.clientY - interaction.clientY) / Math.max(.05, zoom)
      const next = kind === 'move'
        ? { ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy }
        : { ...interaction.bounds, w: Math.max(definition.minSize.w, interaction.bounds.w + dx), h: Math.max(definition.minSize.h, interaction.bounds.h + dy) }
      latestBounds.current = next
      setPreviewBounds(next)
      onBoundsPreview?.(next, kind)
    }
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== interaction.pointerId) return
      cleanupRef.current?.()
      cleanupRef.current = null
      const next = latestBounds.current
      setPreviewBounds(null)
      onBoundsPreview?.(null, kind)
      if (next.x !== interaction.bounds.x || next.y !== interaction.bounds.y || next.w !== interaction.bounds.w || next.h !== interaction.bounds.h) onBoundsCommit(next, kind)
    }
    const cancel = (pointer: PointerEvent) => {
      if (pointer.pointerId !== interaction.pointerId) return
      cleanupRef.current?.()
      cleanupRef.current = null
      latestBounds.current = interaction.bounds
      setPreviewBounds(null)
      onBoundsPreview?.(null, kind)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
    cleanupRef.current?.()
    cleanupRef.current = cleanup
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  return <div
    className={`lcos-surface-component-frame type-${element.type} ${selected ? 'is-selected' : ''} ${pinned ? 'is-pinned' : ''} ${collapsed ? 'is-collapsed' : ''} ${reducedMotion ? 'is-reduced-motion' : ''}`}
    data-surface-component-id={element.id}
    data-surface-component-type={element.type}
    style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, zIndex: element.presentation?.zIndex ?? 3 }}
    onPointerDown={(event) => { event.stopPropagation(); onSelect() }}
  >
    <div className="lcos-surface-component-chrome" onPointerDown={(event) => begin('move', event)}>
      <span>{definition.label}</span>
      <nav>
        {showPin && <button type="button" aria-label={pinned ? `解除固定 ${definition.label}` : `固定 ${definition.label}`} title={pinned ? '解除固定' : '固定位置'} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPresentationChange({ ...element.presentation, pinned: !pinned }) }}>{pinned ? '●' : '○'}</button>}
        {definition.capabilities.collapse && <button type="button" aria-label={collapsed ? `展开 ${definition.label}` : `收起 ${definition.label}`} title={collapsed ? '展开' : '收起'} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPresentationChange({ ...element.presentation, collapsed: !collapsed }) }}>{collapsed ? '＋' : '−'}</button>}
        {definition.capabilities.removeProjection && <button type="button" aria-label={`移除 ${definition.label} 投影`} title="只移除这里的投影，不删除 Project Truth" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemove() }}>×</button>}
      </nav>
    </div>
    <div className="lcos-surface-component-content">{children}</div>
    {definition.resizable && !pinned && <button type="button" className="lcos-surface-component-resize" aria-label={`调整 ${definition.label} 大小`} onPointerDown={(event) => begin('resize', event)} />}
  </div>
}
