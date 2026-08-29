import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from 'react'
import type { StableSurfaceRefV0 } from '@local-creative-os/contracts'
import type { Camera } from '../../model'
import { applySpatialWheelGesture, spatialScreenToWorld } from './spatialCamera'
import { spatialDensityForSize } from './spatialLod'
import { advanceSpatialPan, beginSpatialPan, endSpatialPointer } from './spatialInteractionMachine'
import { CanvasEdgePinLayer, type CanvasEdgePinItem } from './CanvasEdgePinLayer'
import { SpatialBeaconLayer } from './SpatialBeaconLayer'
import { spatialMarkerSurfaceForCanvas, type SpatialMarkerItem } from './spatialMarkerSystem'
import { SpatialMarkerLayer } from './SpatialMarkerLayer'
import { useProjectSpatialMarkersOrNull } from './ProjectSpatialMarkerContext'
import { SpatialOverlayLayer } from './SpatialOverlayLayer'
import { SpatialViewport } from './SpatialViewport'
import { IDLE_SPATIAL_POINTER, type SpatialCameraSetter, type SpatialPoint, type SpatialPointerSession } from './spatialTypes'
import { LCOS_MATERIAL_TRANSFER_MIME } from '../../state/materialTransfer'
import type { MiniMapVisualKind } from './minimapSemantics'
import type { SpatialBeaconState } from './useSpatialFocusRequest'

export interface SpatialPointerContext {
  event: ReactPointerEvent<HTMLDivElement>
  rect: DOMRect
  world: SpatialPoint
}

export interface SpatialCanvasItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  label?: string
  visualKind?: MiniMapVisualKind
}

const DEFAULT_SEMANTIC_DROP_TARGETS: Readonly<Record<string, { id: string; label: string }>> = {
  canvas: { id: 'surface:arrange', label: '在主画布使用' },
  'context-graph-spatial': { id: 'surface:context-graph', label: '加入 Context Graph' },
  'context-space-spatial': { id: 'surface:context', label: '加入当前 Context' },
  'context-flow-spatial': { id: 'surface:context', label: '加入当前 Context' },
  'context-tree-spatial': { id: 'surface:context', label: '加入当前 Context' },
  'workflow-graph-spatial': { id: 'surface:workflow-graph', label: '加入 Workflow Graph' },
  'workflow-spatial': { id: 'surface:workflow', label: '加入当前 Workflow' },
}

interface Props {
  camera: Camera
  setCamera: SpatialCameraSetter
  children: ReactNode
  overlays?: ReactNode
  className?: string
  worldClassName?: string
  worldTestId?: string
  worldStyle?: CSSProperties
  style?: CSSProperties
  disabled?: boolean
  tabIndex?: number
  testId?: string
  ariaBusy?: boolean
  nodeCount?: number
  edgeCount?: number
  locked?: boolean
  onPointerDown?: (context: SpatialPointerContext) => void
  onPointerMove?: (context: SpatialPointerContext) => void
  onPointerUp?: (context: SpatialPointerContext) => void
  onPointerCancel?: (context: SpatialPointerContext) => void
  onPointerWorldChange?: (point: SpatialPoint) => void
  onFilesDropped?: (files: File[], point: SpatialPoint) => void
  onExternalDrop?: (kind: string, id: string, screen: { x: number; y: number }, point: SpatialPoint) => void
  marqueeItems?: readonly SpatialCanvasItem[]
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  minimapItems?: readonly SpatialCanvasItem[]
  /** Live Presentation bounds/labels used only to project durable Marker targets. */
  markerAnchorItems?: readonly SpatialCanvasItem[]
  /** Ephemeral navigation candidates (semantic regions etc). Never persisted by SpatialCanvas. */
  navigationMarkerItems?: readonly SpatialMarkerItem[]
  onNavigationMarkerLocate?: (id: string) => void
  minimapLabel?: string
  beacon?: SpatialBeaconState | null
  onBeaconArrivalEnd?: () => void
  onPanningChange?: (active: boolean) => void
  semanticDropTarget?: { readonly id: string; readonly label: string }
  /** Canonical durable surface identity. Never use route/test ids for persisted Marker ownership. */
  surfaceRef?: StableSurfaceRefV0
  /** §4.13 边缘气泡标点:只传「被标点」对象(pinned/选中/被圈,调用方过滤);不传则不出气泡层 */
  edgePinItems?: readonly CanvasEdgePinItem[]
  /** 边缘气泡点击回调:复用调用方既有 focus 链把相机滑过去(本组件不新写跳转) */
  onEdgePinLocate?: (id: string) => void
}

/**
 * Shared camera/transform shell for Arrange, Context and Workflow.
 * Domain-specific node drag, relation editing and presentation commits stay in adapters.
 */
export const SpatialCanvas = forwardRef<HTMLDivElement, Props>(function SpatialCanvas({
  camera,
  setCamera,
  children,
  overlays,
  className = '',
  worldClassName = '',
  worldTestId,
  worldStyle,
  style,
  disabled = false,
  tabIndex = -1,
  testId,
  ariaBusy,
  nodeCount,
  edgeCount,
  locked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerWorldChange,
  onFilesDropped,
  onExternalDrop,
  marqueeItems,
  onMarqueeSelect,
  minimapItems,
  markerAnchorItems,
  navigationMarkerItems = [],
  onNavigationMarkerLocate,
  minimapLabel = '视图地图',
  beacon,
  onBeaconArrivalEnd,
  onPanningChange,
  semanticDropTarget,
  surfaceRef,
  edgePinItems,
  onEdgePinLocate,
}, forwardedRef) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wheelHandlerRef = useRef<(event: globalThis.WheelEvent) => void>(() => {})
  const pointerSession = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const marqueeSession = useRef<{ pointerId: number; startScreen: SpatialPoint; currentScreen: SpatialPoint; startWorld: SpatialPoint; currentWorld: SpatialPoint; moved: boolean; additive: boolean } | null>(null)
  const wheelFrame = useRef<number | null>(null)
  const wheelPan = useRef({ x: 0, y: 0 })
  const wheelZoom = useRef<{ deltaY: number; anchorX: number; anchorY: number; precision: boolean } | null>(null)
  const [panning, setPanning] = useState(false)
  const [size, setSize] = useState({ width: 1440, height: 900 })
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [materialReceiving, setMaterialReceiving] = useState(false)
  const markerRuntime = useProjectSpatialMarkersOrNull()
  const effectiveSurfaceRef: StableSurfaceRefV0 | undefined = surfaceRef ?? (testId === 'canvas' ? 'main' : undefined)
  const markerSourceItems = markerAnchorItems ?? marqueeItems ?? minimapItems ?? []
  const durableMarkerItems = useMemo<readonly SpatialMarkerItem[]>(() => {
    if (!markerRuntime || !effectiveSurfaceRef) return []
    const localById = new Map(markerSourceItems.map((item) => [item.id, item] as const))
    return markerRuntime.records.flatMap(({ intent, resolution }) => {
      if (!resolution || resolution.status !== 'resolved' || resolution.target.surfaceRef !== effectiveSurfaceRef) return []
      const local = resolution.target.anchorRef ? localById.get(resolution.target.anchorRef) : undefined
      const point = resolution.target.worldPosition
      if (!local && !point) return []
      const bounds = local
        ? { x: local.x, y: local.y, width: local.width, height: local.height }
        : { x: point!.x - 8, y: point!.y - 8, width: 16, height: 16 }
      return [{
        id: intent.id,
        label: local?.label ?? '空间标记',
        bounds,
        surface: resolution.target.surfaceKind,
        scope: intent.scope,
        sourceSurfaceRef: intent.sourceSurfaceRef,
        targetSurfaceRef: resolution.target.surfaceRef,
        groupKey: 'durable-marker',
        groupLabel: '空间标记',
      } satisfies SpatialMarkerItem]
    })
  }, [effectiveSurfaceRef, markerRuntime, markerSourceItems])

  const locateDurableMarker = (markerId: string) => {
    if (!markerRuntime || !effectiveSurfaceRef) return
    void markerRuntime.resolveMarker(markerId).then((resolution) => {
      if (!resolution || resolution.status !== 'resolved' || resolution.target.surfaceRef !== effectiveSurfaceRef) return
      const local = resolution.target.anchorRef ? markerSourceItems.find((item) => item.id === resolution.target.anchorRef) : undefined
      const point = local
        ? { x: local.x + local.width / 2, y: local.y + local.height / 2 }
        : resolution.target.worldPosition
      if (!point) return
      setCamera((current) => ({ ...current, x: size.width / 2 - point.x * current.zoom, y: size.height / 2 - point.y * current.zoom }))
    })
  }

  const navigationMarkerIds = useMemo(() => new Set(navigationMarkerItems.map((item) => item.id)), [navigationMarkerItems])
  const unifiedMarkerItems = useMemo<readonly SpatialMarkerItem[]>(() => [...durableMarkerItems, ...navigationMarkerItems], [durableMarkerItems, navigationMarkerItems])
  const locateUnifiedMarker = (markerId: string) => {
    if (navigationMarkerIds.has(markerId)) { onNavigationMarkerLocate?.(markerId); return }
    locateDurableMarker(markerId)
  }

  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const update = () => setSize({ width: root.clientWidth || 1, height: root.clientHeight || 1 })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (wheelFrame.current !== null) cancelAnimationFrame(wheelFrame.current)
  }, [])

  useEffect(() => {
    if (!disabled) return
    pointerSession.current = endSpatialPointer()
    marqueeSession.current = null
    setMarqueeRect(null)
    setPanning(false)
    onPanningChange?.(false)
  }, [disabled, onPanningChange])

  const scheduleWheel = () => {
    if (wheelFrame.current !== null) return
    wheelFrame.current = requestAnimationFrame(() => {
      wheelFrame.current = null
      const panDelta = wheelPan.current
      const zoomGesture = wheelZoom.current
      wheelPan.current = { x: 0, y: 0 }
      wheelZoom.current = null
      setCamera((current) => {
        let next = applySpatialWheelGesture(current, { deltaX: panDelta.x, deltaY: panDelta.y, zoom: false, anchorX: 0, anchorY: 0 })
        if (zoomGesture) next = applySpatialWheelGesture(next, { deltaX: 0, deltaY: zoomGesture.deltaY, zoom: true, anchorX: zoomGesture.anchorX, anchorY: zoomGesture.anchorY, precision: zoomGesture.precision })
        return next
      })
    })
  }

  const contextFor = (event: ReactPointerEvent<HTMLDivElement>): SpatialPointerContext => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { event, rect, world: spatialScreenToWorld(event.clientX, event.clientY, rect, camera) }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) { event.preventDefault(); event.stopPropagation(); return }
    if (event.button === 1) {
      event.preventDefault()
      pointerSession.current = beginSpatialPan(event.pointerId, { x: event.clientX, y: event.clientY }, camera)
      setPanning(true)
      onPanningChange?.(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button === 0 && marqueeItems && onMarqueeSelect) {
      const target = event.target as HTMLElement
      const interactive = target.closest('button, article, input, textarea, select, summary, [draggable="true"], [data-node-id], [data-project-view-drop-target], .lcos-spatial-placement, .lcos-workflow-node, .lcos-signal-child, .lcos-signal-segment')
      if (!interactive) {
        const context = contextFor(event)
        const screen = { x: event.clientX - context.rect.left, y: event.clientY - context.rect.top }
        marqueeSession.current = { pointerId: event.pointerId, startScreen: screen, currentScreen: screen, startWorld: context.world, currentWorld: context.world, moved: false, additive: event.shiftKey }
        setMarqueeRect({ left: screen.x, top: screen.y, width: 0, height: 0 })
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    onPointerDown?.(contextFor(event))
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) { event.preventDefault(); event.stopPropagation(); return }
    const context = contextFor(event)
    onPointerWorldChange?.(context.world)
    if (marqueeSession.current?.pointerId === event.pointerId) {
      const screen = { x: event.clientX - context.rect.left, y: event.clientY - context.rect.top }
      const session = marqueeSession.current
      const moved = session.moved || Math.hypot(screen.x - session.startScreen.x, screen.y - session.startScreen.y) > 4
      marqueeSession.current = { ...session, currentScreen: screen, currentWorld: context.world, moved }
      setMarqueeRect({ left: Math.min(session.startScreen.x, screen.x), top: Math.min(session.startScreen.y, screen.y), width: Math.abs(screen.x - session.startScreen.x), height: Math.abs(screen.y - session.startScreen.y) })
      return
    }
    const nextCamera = advanceSpatialPan(pointerSession.current, { x: event.clientX, y: event.clientY })
    if (nextCamera) {
      setCamera(nextCamera)
      return
    }
    onPointerMove?.(context)
  }

  const finishMarquee = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    const session = marqueeSession.current
    if (!session || session.pointerId !== event.pointerId || !onMarqueeSelect) return false
    marqueeSession.current = null
    setMarqueeRect(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!session.moved) {
      onMarqueeSelect([], false)
      return true
    }
    const left = Math.min(session.startWorld.x, session.currentWorld.x)
    const right = Math.max(session.startWorld.x, session.currentWorld.x)
    const top = Math.min(session.startWorld.y, session.currentWorld.y)
    const bottom = Math.max(session.startWorld.y, session.currentWorld.y)
    const ids = (marqueeItems ?? []).filter((item) => item.x < right && item.x + item.width > left && item.y < bottom && item.y + item.height > top).map((item) => item.id)
    onMarqueeSelect(ids, session.additive)
    return true
  }

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    if (pointerSession.current.kind !== 'pan') return false
    pointerSession.current = endSpatialPointer()
    setPanning(false)
    onPanningChange?.(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    return true
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) { event.stopPropagation(); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    if (event.ctrlKey || event.metaKey) {
      const current = wheelZoom.current
      wheelZoom.current = { deltaY: (current?.deltaY ?? 0) + event.deltaY * unit, anchorX: event.clientX - rect.left, anchorY: event.clientY - rect.top, precision: event.shiftKey }
    } else {
      wheelPan.current = { x: wheelPan.current.x + event.deltaX * unit, y: wheelPan.current.y + event.deltaY * unit }
    }
    scheduleWheel()
  }

  // React onWheel 是 passive 监听，preventDefault 会被拒绝并触发控制台警告；
  // 改为原生 non-passive wheel 监听，保证缩放时能正确拦截页面滚动。
  wheelHandlerRef.current = (event: globalThis.WheelEvent) => {
    handleWheel(event as unknown as WheelEvent<HTMLDivElement>)
  }
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (event: globalThis.WheelEvent) => wheelHandlerRef.current(event)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setMaterialReceiving(false)
    const materialTransfer = event.dataTransfer.getData(LCOS_MATERIAL_TRANSFER_MIME)
    if (materialTransfer && onExternalDrop) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onExternalDrop('material-transfer', materialTransfer, { x: event.clientX, y: event.clientY }, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      return
    }
    const workflowOperator = event.dataTransfer.getData('application/x-lcos-workflow-operator')
    if (workflowOperator && onExternalDrop) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onExternalDrop('workflow-operator', workflowOperator, { x: event.clientX, y: event.clientY }, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      return
    }
    const projectView = event.dataTransfer.getData('application/x-lcos-project-view')
    if (projectView && onExternalDrop) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onExternalDrop('project-view', projectView, { x: event.clientX, y: event.clientY }, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      return
    }
    const workspaceId = event.dataTransfer.getData('application/x-lcos-workspace')
    if (workspaceId && onExternalDrop) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onExternalDrop('workspace', workspaceId, { x: event.clientX, y: event.clientY }, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      return
    }
    const files = [...event.dataTransfer.files]
    if (onFilesDropped && files.length) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onFilesDropped(files, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      return
    }
    if (onExternalDrop) {
      const uri = event.dataTransfer.getData('text/uri-list').split('\n').map((item) => item.trim()).find((item) => item && !item.startsWith('#'))
      const text = event.dataTransfer.getData('text/plain').trim()
      const value = uri || text
      if (value) {
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        onExternalDrop(uri ? 'uri' : 'text', value, { x: event.clientX, y: event.clientY }, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
      }
    }
  }

  const density = spatialDensityForSize(size)
  const resolvedSemanticDropTarget = semanticDropTarget ?? (testId ? DEFAULT_SEMANTIC_DROP_TARGETS[testId] : undefined)

  return <div
    ref={rootRef}
    data-testid={testId}
    data-project-view-drop-target={resolvedSemanticDropTarget?.id}
    data-project-view-drop-label={resolvedSemanticDropTarget?.label}
    data-spatial-canvas="true"
    data-spatial-density={density}
    data-pointer-state={panning ? 'pan-closed-hand' : 'pan-open-hand'}
    data-camera-x={camera.x}
    data-camera-y={camera.y}
    data-camera-zoom={camera.zoom}
    data-node-count={nodeCount}
    data-edge-count={edgeCount}
    data-locked={locked || undefined}
    tabIndex={tabIndex}
    aria-busy={ariaBusy || undefined}
    className={`lcos-spatial-canvas ${className} ${panning ? 'panning' : ''} ${materialReceiving ? 'is-material-receiving' : ''}`.trim()}
    style={style}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={(event) => { if (!finishMarquee(event) && !finishPan(event)) onPointerUp?.(contextFor(event)) }}
    onPointerCancel={(event) => {
      if (marqueeSession.current?.pointerId === event.pointerId) {
        marqueeSession.current = null
        setMarqueeRect(null)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        return
      }
      if (!finishPan(event)) onPointerCancel?.(contextFor(event))
    }}
    onDragOver={(event) => {
      const material = event.dataTransfer.types.includes(LCOS_MATERIAL_TRANSFER_MIME)
      if (material && onExternalDrop) setMaterialReceiving(true)
      const external = material || event.dataTransfer.types.includes('application/x-lcos-workspace') || event.dataTransfer.types.includes('application/x-lcos-project-view') || event.dataTransfer.types.includes('application/x-lcos-workflow-operator')
      if (external && onExternalDrop) event.preventDefault()
      else if (onFilesDropped && event.dataTransfer.types.includes('Files')) event.preventDefault()
      else if (onExternalDrop && (event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain'))) event.preventDefault()
    }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMaterialReceiving(false) }}
    onDrop={handleDrop}
  >
    <SpatialViewport camera={camera} className={worldClassName} testId={worldTestId} style={worldStyle}>{children}</SpatialViewport>
    {(overlays !== undefined || marqueeRect || beacon || unifiedMarkerItems.length > 0 || (minimapItems && minimapItems.length > 0) || (edgePinItems && edgePinItems.length > 0 && onEdgePinLocate)) && <SpatialOverlayLayer>
      {overlays}
      {marqueeRect && <div className="lcos-spatial-marquee" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} />}
      {minimapItems && minimapItems.length > 0 && <SpatialMiniMap items={minimapItems} camera={camera} setCamera={setCamera} viewportSize={size} label={minimapLabel} beacon={beacon}/>}
      {beacon && <SpatialBeaconLayer beacon={beacon} camera={camera} onArrivalEnd={onBeaconArrivalEnd} surface={spatialMarkerSurfaceForCanvas(testId)} sourceSurfaceRef={effectiveSurfaceRef}/>}
      {/* §4.13 边缘气泡标点:不跟随相机 transform 的固定屏幕层(minimap 同层),viewportSize 复用容器 ResizeObserver 实测值 */}
      {unifiedMarkerItems.length > 0 && <SpatialMarkerLayer items={unifiedMarkerItems} camera={camera} viewportSize={size} currentSurfaceRef={effectiveSurfaceRef} onLocate={locateUnifiedMarker}/>}
      {edgePinItems && edgePinItems.length > 0 && onEdgePinLocate && <CanvasEdgePinLayer camera={camera} viewportSize={size} items={edgePinItems} currentSurfaceRef={effectiveSurfaceRef} defaultSurface={spatialMarkerSurfaceForCanvas(testId)} onLocate={onEdgePinLocate}/>}
    </SpatialOverlayLayer>}
  </div>
})

function SpatialMiniMap({ items, camera, setCamera, viewportSize, label, beacon }: { items: readonly SpatialCanvasItem[]; camera: Camera; setCamera: SpatialCameraSetter; viewportSize: { width: number; height: number }; label: string; beacon?: SpatialBeaconState | null }) {
  const [collapsed, setCollapsed] = useState(false)
  const bounds = spatialItemBounds(items)
  const width = 152, height = 76, padding = 7
  const scale = Math.min((width - padding * 2) / Math.max(bounds.width, 1), (height - padding * 2) / Math.max(bounds.height, 1))
  const offsetX = padding + (width - padding * 2 - bounds.width * scale) / 2
  const offsetY = padding + (height - padding * 2 - bounds.height * scale) / 2
  const worldToMapX = (x: number) => offsetX + (x - bounds.x) * scale
  const worldToMapY = (y: number) => offsetY + (y - bounds.y) * scale
  const viewWorld = { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, width: viewportSize.width / camera.zoom, height: viewportSize.height / camera.zoom }
  if (collapsed) return <section className="lcos-spatial-minimap is-collapsed" data-testid="spatial-surface-minimap" aria-label={label}><button type="button" className="lcos-spatial-minimap-expand" aria-label={`展开${label}小地图`} title={`展开${label}小地图`} onClick={() => setCollapsed(false)}><Maximize2 size={13}/></button></section>
  return <section className="lcos-spatial-minimap" data-testid="spatial-surface-minimap" aria-label={label}>
    <header><span>{label}</span><span className="lcos-spatial-minimap-meta"><small>{items.length}</small><button type="button" aria-label={`收起${label}小地图`} title="收起小地图" onClick={() => setCollapsed(true)}><Minimize2 size={12}/></button></span></header>
    <button type="button" className="lcos-spatial-minimap-map" aria-label={`在${label}中定位`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const localX = event.clientX - rect.left, localY = event.clientY - rect.top
      const worldX = bounds.x + (localX - offsetX) / scale
      const worldY = bounds.y + (localY - offsetY) / scale
      setCamera((current) => ({ ...current, x: viewportSize.width / 2 - worldX * current.zoom, y: viewportSize.height / 2 - worldY * current.zoom }))
    }}>
      {items.map((item) => <i key={item.id} data-minimap-kind={item.visualKind ?? 'generic'} data-minimap-beacon={beacon?.target.id === item.id || undefined} title={item.label} style={{ left: worldToMapX(item.x), top: worldToMapY(item.y), width: Math.max(2, item.width * scale), height: Math.max(2, item.height * scale) }} />)}
      <b style={{ left: worldToMapX(viewWorld.x), top: worldToMapY(viewWorld.y), width: Math.max(4, viewWorld.width * scale), height: Math.max(4, viewWorld.height * scale) }} />
    </button>
  </section>
}

function spatialItemBounds(items: readonly SpatialCanvasItem[]) {
  const left = Math.min(...items.map((item) => item.x))
  const top = Math.min(...items.map((item) => item.y))
  const right = Math.max(...items.map((item) => item.x + item.width))
  const bottom = Math.max(...items.map((item) => item.y + item.height))
  const padding = 80
  return { x: left - padding, y: top - padding, width: Math.max(320, right - left + padding * 2), height: Math.max(220, bottom - top + padding * 2) }
}
