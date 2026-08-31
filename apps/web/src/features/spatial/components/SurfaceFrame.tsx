import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Lock, MapPin, Maximize2, Minimize2, MoreHorizontal, Trash2, Unlock } from 'lucide-react'
import type { SurfaceBounds, SurfaceElement } from '../model/surfaceElementTypes'
import type { SurfaceComponentDefinition } from './surfaceComponentRegistry'
import { useReducedSpatialMotion } from '../visual/useReducedSpatialMotion'
import { additiveSelectionModifier } from '../pointerInteractionLanguage'
import { ObjectOrbit, type ObjectOrbitAction } from '../../ui/ObjectOrbit'
import { queryStack, register as registerOverlay } from '../../ui/overlayStack'

interface Props {
  readonly element: SurfaceElement
  readonly definition: SurfaceComponentDefinition
  readonly zoom: number
  readonly selected: boolean
  readonly overlap?: boolean
  readonly lensFocus?: boolean
  readonly onSelect: (additive: boolean) => void
  readonly onBoundsCommit: (bounds: SurfaceBounds, kind: 'move' | 'resize') => void
  readonly onBoundsPreview?: (bounds: SurfaceBounds | null, kind: 'move' | 'resize') => void
  readonly onPresentationChange: (presentation: SurfaceElement['presentation']) => void
  readonly onRemove: () => void
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
const additiveSelection = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean => additiveSelectionModifier(event)

/**
 * A22 Surface Component host.
 *
 * Component = Spatial Instrument, not a mini window. The host owns only spatial
 * grammar: Selection / move / resize / Locator / Action Arc / management menu.
 * The functional face remains renderer-owned.
 */
export function SurfaceFrame({ element, definition, zoom, selected, overlap = false, lensFocus = false, onSelect, onBoundsCommit, onBoundsPreview, onPresentationChange, onRemove, children }: Props) {
  const reducedMotion = useReducedSpatialMotion()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const locatorRef = useRef<HTMLButtonElement | null>(null)
  const [previewBounds, setPreviewBounds] = useState<SurfaceBounds | null>(null)
  const [orbitOpen, setOrbitOpen] = useState(false)
  const [menu, setMenu] = useState<{ readonly x: number; readonly y: number } | null>(null)
  const latestBounds = useRef(element.bounds)
  const cleanupRef = useRef<(() => void) | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuOverlayId = useId()
  const bounds = previewBounds ?? element.bounds
  const positionLocked = Boolean(element.presentation?.pinned)
  const collapsed = Boolean(element.presentation?.collapsed)
  const uiScale = 1 / Math.max(.2, zoom)

  useEffect(() => { if (!previewBounds) latestBounds.current = element.bounds }, [element.bounds, previewBounds])
  useEffect(() => () => cleanupRef.current?.(), [])
  useEffect(() => { if (!selected) { setOrbitOpen(false); setMenu(null) } }, [selected])

  useEffect(() => {
    if (!menu) return undefined
    return registerOverlay(menuOverlayId, {
      kind: 'menu',
      element: () => menuRef.current,
      onEsc: () => setMenu(null),
      dismissOnOutside: true,
    })
  }, [menu, menuOverlayId])

  useEffect(() => {
    if (!menu) return undefined
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && menuRef.current?.contains(target)) return
      const stack = queryStack()
      if (stack[stack.length - 1]?.id !== menuOverlayId) return
      setMenu(null)
    }
    window.addEventListener('pointerdown', closeOutside, true)
    return () => window.removeEventListener('pointerdown', closeOutside, true)
  }, [menu, menuOverlayId])

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
    if (event.button !== 0 || positionLocked || collapsed) return
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
      cleanupRef.current?.(); cleanupRef.current = null
      const next = latestBounds.current
      setPreviewBounds(null); onBoundsPreview?.(null, session.interaction.kind)
      if (next.x !== session.bounds.x || next.y !== session.bounds.y || next.w !== session.bounds.w || next.h !== session.bounds.h) onBoundsCommit(next, session.interaction.kind)
    }
    const cancel = (pointer: PointerEvent) => {
      if (pointer.pointerId !== session.pointerId) return
      cleanupRef.current?.(); cleanupRef.current = null
      latestBounds.current = session.bounds
      setPreviewBounds(null); onBoundsPreview?.(null, session.interaction.kind)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
    cleanupRef.current?.(); cleanupRef.current = cleanup
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  const openManagementMenu = (x?: number, y?: number) => {
    const rect = (collapsed ? locatorRef.current : frameRef.current)?.getBoundingClientRect()
    setMenu({ x: x ?? (rect?.right ?? 0) + 8, y: y ?? (rect?.top ?? 0) })
    setOrbitOpen(false)
  }

  const toggleCollapsed = () => {
    onPresentationChange({ ...element.presentation, collapsed: !collapsed })
    setOrbitOpen(false)
  }

  const orbitActions: ObjectOrbitAction[] = [
    {
      id: collapsed ? 'component-expand' : 'component-collapse',
      label: collapsed ? '展开' : '收起',
      icon: collapsed ? Maximize2 : Minimize2,
      primary: true,
      onClick: toggleCollapsed,
    },
    { id: 'component-more', label: '更多', icon: MoreHorizontal, onClick: () => openManagementMenu() },
  ]

  const onBodyPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const target = event.target as HTMLElement | null
    if (event.button !== 0 || target?.closest(INTERACTIVE_SELECTOR)) { onSelect(false); return }
    begin({ kind: 'move' }, event)
  }

  const locator = <button
    ref={locatorRef}
    type="button"
    className={`lcos-component-map-locator ${collapsed ? 'is-collapsed' : 'is-expanded'} ${selected ? 'is-selected' : ''}`}
    data-component-locator={element.id}
    aria-label={collapsed ? `展开 ${definition.label}` : `${definition.label} 空间导航与操作`}
    title={collapsed ? `${definition.label} · 点击展开` : `${definition.label} · 空间定位点`}
    style={{ '--component-ui-scale': String(uiScale) } as CSSProperties}
    onPointerDown={(event) => { event.stopPropagation(); if (event.button === 0) onSelect(additiveSelection(event)) }}
    onClick={(event) => { event.stopPropagation(); if (collapsed) toggleCollapsed(); else setOrbitOpen(true) }}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(false); openManagementMenu(event.clientX, event.clientY) }}
  ><MapPin size={38} strokeWidth={2.35} aria-hidden="true" /></button>

  const managementMenu = typeof document !== 'undefined' && menu ? createPortal(
    <div ref={menuRef} className="lcos-component-management-menu" data-native-context-menu="true" role="menu" aria-label={`${definition.label} 管理`} style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      <header><strong>{definition.label}</strong><small>Component</small></header>
      <button type="button" onClick={() => { onPresentationChange({ ...element.presentation, pinned: !positionLocked }); setMenu(null) }}>{positionLocked ? <Unlock size={14}/> : <Lock size={14}/>}<span>{positionLocked ? '解除固定位置' : '固定位置'}</span></button>
      {definition.capabilities.collapse && <button type="button" onClick={() => { toggleCollapsed(); setMenu(null) }}>{collapsed ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}<span>{collapsed ? '展开' : '收起为导航标'}</span></button>}
      {definition.capabilities.removeProjection && <button type="button" className="danger with-divider" onClick={() => { setMenu(null); onRemove() }}><Trash2 size={14}/><span>从当前现场移除</span></button>}
    </div>,
    document.body,
  ) : null

  if (collapsed) {
    const anchorStyle = { left: bounds.x + bounds.w / 2, top: bounds.y, zIndex: 'var(--lcos-z-surface-comp-selected)' } as CSSProperties
    return <>
      <div className={`lcos-component-locator-anchor ${selected ? 'is-selected' : ''}`} style={anchorStyle}>{locator}</div>
      <ObjectOrbit open={orbitOpen} onClose={() => setOrbitOpen(false)} anchorRef={locatorRef} ariaLabel={`${definition.label} 的动作`} actions={orbitActions}/>
      {managementMenu}
    </>
  }

  const frameZIndex = selected ? (element.presentation?.zIndex ?? 'var(--lcos-z-surface-comp-selected)') : (element.presentation?.zIndex ?? 'var(--lcos-z-surface-comp)')
  return <>
    <div
      ref={frameRef}
      className={`lcos-surface-component-frame type-${element.type} ${selected ? 'is-selected' : ''} ${overlap ? 'is-overlap' : ''} ${lensFocus ? 'is-lens-focus' : ''} ${positionLocked ? 'is-pinned' : ''} ${reducedMotion ? 'is-reduced-motion' : ''}`}
      data-surface-component-id={element.id}
      data-surface-component-type={element.type}
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, zIndex: frameZIndex, '--component-ui-scale': String(uiScale) } as CSSProperties}
      onPointerDown={onBodyPointerDown}
      onClick={(event) => { const target = event.target as HTMLElement | null; if (!target?.closest(INTERACTIVE_SELECTOR)) { event.stopPropagation(); setOrbitOpen(true) } }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(false); openManagementMenu(event.clientX, event.clientY) }}
    >
      <div className="lcos-component-locator-anchor in-frame">{locator}</div>
      <div className="lcos-surface-component-content">{children}</div>
      {definition.resizable && !positionLocked && (['n', 's', 'e', 'w'] as const).map((edge) => (
        <span key={edge} className={`lcos-surface-component-edge edge-${edge}`} data-surface-resize-edge={edge} onPointerDown={(event) => begin({ kind: 'resize', edge }, event)}/>
      ))}
    </div>
    <ObjectOrbit open={orbitOpen && selected} onClose={() => setOrbitOpen(false)} anchorRef={frameRef} ariaLabel={`${definition.label} 的动作`} actions={orbitActions}/>
    {managementMenu}
  </>
}
