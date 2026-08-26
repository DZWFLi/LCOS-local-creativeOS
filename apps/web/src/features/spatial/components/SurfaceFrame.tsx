import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { SurfaceBounds, SurfaceElement } from '../model/surfaceElementTypes'
import type { SurfaceComponentDefinition } from './surfaceComponentRegistry'
import { useReducedSpatialMotion } from '../visual/useReducedSpatialMotion'

interface Props {
  readonly element: SurfaceElement
  readonly definition: SurfaceComponentDefinition
  readonly zoom: number
  readonly selected: boolean
  /** B-4：拖拽中与其它组件重叠 ≥30% 面积时的碰撞提示态。 */
  readonly overlap?: boolean
  /** lens 聚焦反馈:lens 三键定位/创建该组件时的短暂高亮脉冲(交互反馈,复用紫 accent)。 */
  readonly lensFocus?: boolean
  /** G-2:点选回调携带 additive(Shift/Ctrl 加选);点在内部交互控件上恒为 false(单选宿主)。 */
  readonly onSelect: (additive: boolean) => void
  readonly onBoundsCommit: (bounds: SurfaceBounds, kind: 'move' | 'resize') => void
  readonly onBoundsPreview?: (bounds: SurfaceBounds | null, kind: 'move' | 'resize') => void
  readonly onPresentationChange: (presentation: SurfaceElement['presentation']) => void
  readonly onRemove: () => void
  readonly showPin?: boolean
  readonly children: ReactNode
}

type ResizeEdge = 'n' | 's' | 'e' | 'w'
type Interaction = { readonly kind: 'move' } | { readonly kind: 'resize'; readonly edge: ResizeEdge }

interface PointerSession {
  readonly interaction: Interaction
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly bounds: SurfaceBounds
}

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [contenteditable="true"], [data-surface-no-drag]'

/** G-2 统一键位:组件点选的加选判定与主画布/节点点选同款(Shift/Ctrl/Cmd 任一)。 */
const additiveSelection = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean =>
  event.shiftKey || event.ctrlKey || event.metaKey

/**
 * Direct manipulation: the component body is its own handle, edges resize.
 * No title bar, no card shell — the component's visual material is drawn by
 * its renderer (capsule head + segments + matrix), never by this frame.
 * Middle button stays reserved for camera panning on the SpatialCanvas.
 */
export function SurfaceFrame({ element, definition, zoom, selected, overlap = false, lensFocus = false, onSelect, onBoundsCommit, onBoundsPreview, onPresentationChange, onRemove, showPin = true, children }: Props) {
  const reducedMotion = useReducedSpatialMotion()
  const [previewBounds, setPreviewBounds] = useState<SurfaceBounds | null>(null)
  const latestBounds = useRef(element.bounds)
  const cleanupRef = useRef<(() => void) | null>(null)
  const bounds = previewBounds ?? element.bounds
  const pinned = Boolean(element.presentation?.pinned)
  const collapsed = Boolean(element.presentation?.collapsed)

  useEffect(() => { if (!previewBounds) latestBounds.current = element.bounds }, [element.bounds, previewBounds])
  useEffect(() => () => cleanupRef.current?.(), [])

  const applyInteraction = (session: PointerSession, clientX: number, clientY: number): SurfaceBounds => {
    const dx = (clientX - session.clientX) / Math.max(.05, zoom)
    const dy = (clientY - session.clientY) / Math.max(.05, zoom)
    const start = session.bounds
    if (session.interaction.kind === 'move') return { ...start, x: start.x + dx, y: start.y + dy }
    const minW = definition.minSize.w
    const minH = definition.minSize.h
    switch (session.interaction.edge) {
      case 'e': return { ...start, w: Math.max(minW, start.w + dx) }
      case 's': return { ...start, h: Math.max(minH, start.h + dy) }
      case 'w': {
        const w = Math.max(minW, start.w - dx)
        return { ...start, x: start.x + (start.w - w), w }
      }
      default: {
        const h = Math.max(minH, start.h - dy)
        return { ...start, y: start.y + (start.h - h), h }
      }
    }
  }

  const begin = (interaction: Interaction, event: ReactPointerEvent<HTMLElement>) => {
    // Primary button only. Middle button belongs to camera panning (SpatialCanvas).
    if (event.button !== 0 || pinned) return
    if (interaction.kind === 'move' && !definition.movable) return
    if (interaction.kind === 'resize' && !definition.resizable) return
    event.preventDefault(); event.stopPropagation(); onSelect(additiveSelection(event))
    const session: PointerSession = { interaction, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, bounds: element.bounds }
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== session.pointerId) return
      const next = applyInteraction(session, pointer.clientX, pointer.clientY)
      latestBounds.current = next
      setPreviewBounds(next)
      onBoundsPreview?.(next, session.interaction.kind)
    }
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== session.pointerId) return
      cleanupRef.current?.()
      cleanupRef.current = null
      const next = latestBounds.current
      setPreviewBounds(null)
      onBoundsPreview?.(null, session.interaction.kind)
      if (next.x !== session.bounds.x || next.y !== session.bounds.y || next.w !== session.bounds.w || next.h !== session.bounds.h) onBoundsCommit(next, session.interaction.kind)
    }
    const cancel = (pointer: PointerEvent) => {
      if (pointer.pointerId !== session.pointerId) return
      cleanupRef.current?.()
      cleanupRef.current = null
      latestBounds.current = session.bounds
      setPreviewBounds(null)
      onBoundsPreview?.(null, session.interaction.kind)
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

  const onBodyPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    // G-2:非主键或点在内部交互控件上 → 单选宿主组件;组件体拖拽交 begin(additive 透传,避免重复触发)。
    const target = event.target as HTMLElement | null
    if (event.button !== 0 || target?.closest(INTERACTIVE_SELECTOR)) { onSelect(false); return }
    begin({ kind: 'move' }, event)
  }

  // B-4：默认层走 surface-comp token，选中抬升为 surface-comp+1 子 token；
  // 有手动 zIndex 的组件保持其手动排序不被选中态回退。
  const frameZIndex = selected
    ? (element.presentation?.zIndex ?? 'var(--lcos-z-surface-comp-selected)')
    : (element.presentation?.zIndex ?? 'var(--lcos-z-surface-comp)')
  return <div
    className={`lcos-surface-component-frame type-${element.type} ${selected ? 'is-selected' : ''} ${overlap ? 'is-overlap' : ''} ${lensFocus ? 'is-lens-focus' : ''} ${pinned ? 'is-pinned' : ''} ${collapsed ? 'is-collapsed' : ''} ${reducedMotion ? 'is-reduced-motion' : ''}`}
    data-surface-component-id={element.id}
    data-surface-component-type={element.type}
    style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, zIndex: frameZIndex }}
    onPointerDown={onBodyPointerDown}
  >
    <div className="lcos-surface-component-content">{children}</div>
    {definition.resizable && !pinned && (['n', 's', 'e', 'w'] as const).map((edge) => (
      <span
        key={edge}
        className={`lcos-surface-component-edge edge-${edge}`}
        data-surface-resize-edge={edge}
        onPointerDown={(event) => begin({ kind: 'resize', edge }, event)}
      />
    ))}
    <nav className="lcos-surface-component-controls" onPointerDown={(event) => event.stopPropagation()}>
      {showPin && <button type="button" aria-label={pinned ? `解除固定 ${definition.label}` : `固定 ${definition.label}`} title={pinned ? '解除固定' : '固定位置'} onClick={(event) => { event.stopPropagation(); onPresentationChange({ ...element.presentation, pinned: !pinned }) }}>{pinned ? '●' : '○'}</button>}
      {definition.capabilities.collapse && <button type="button" aria-label={collapsed ? `展开 ${definition.label}` : `收起 ${definition.label}`} title={collapsed ? '展开' : '收起'} onClick={(event) => { event.stopPropagation(); onPresentationChange({ ...element.presentation, collapsed: !collapsed }) }}>{collapsed ? '＋' : '−'}</button>}
      {definition.capabilities.removeProjection && <button type="button" aria-label={`移除 ${definition.label} 投影`} title="只移除这里的投影，不删除 Project Truth" onClick={(event) => { event.stopPropagation(); onRemove() }}>×</button>}
    </nav>
  </div>
}
