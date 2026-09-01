import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Camera, CanvasNode, WorkspaceFrameVM } from '../../model'
import { Grid3X3, Maximize2, Minus, Plus } from 'lucide-react'
import { cameraSafeViewportBounds, CANVAS_ZOOM_STEP, fitBoundsForReading, getSelectionBounds, restorationFocusBounds, zoomCameraAt } from './canvasGeometry'
import { useActiveSpatialViewport } from '../spatial/ActiveSpatialViewportContext'
import { spatialInsetsWithinRect } from '../spatial/activeSpatialViewport'
import { miniMapVisualKindForNode } from '../spatial/minimapSemantics'
import type { SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'

interface Props {
  nodes: CanvasNode[]
  workspaceFrames: WorkspaceFrameVM[]
  camera: Camera
  setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onLocateContent?: () => void
  gridSnapEnabled?: boolean
  onGridSnapChange?: (enabled: boolean) => void
  navigationRequest?: SpatialFocusRequest
}

type MapTransform = {
  worldX: number
  worldY: number
  worldWidth: number
  worldHeight: number
  scale: number
  offsetX: number
  offsetY: number
}

function projectBounds(nodes: CanvasNode[], frames: WorkspaceFrameVM[]) {
  const nodeBounds = getSelectionBounds(nodes, nodes.map((node) => node.id))
  const frameBounds = frames.length ? {
    x: Math.min(...frames.map((frame) => frame.bounds.x)),
    y: Math.min(...frames.map((frame) => frame.bounds.y)),
    right: Math.max(...frames.map((frame) => frame.bounds.x + frame.bounds.width)),
    bottom: Math.max(...frames.map((frame) => frame.bounds.y + frame.bounds.height)),
  } : null
  const left = Math.min(nodeBounds?.x ?? 0, frameBounds?.x ?? nodeBounds?.x ?? 0)
  const top = Math.min(nodeBounds?.y ?? 0, frameBounds?.y ?? nodeBounds?.y ?? 0)
  const right = Math.max((nodeBounds?.x ?? 0) + (nodeBounds?.width ?? 640), frameBounds?.right ?? ((nodeBounds?.x ?? 0) + (nodeBounds?.width ?? 640)))
  const bottom = Math.max((nodeBounds?.y ?? 0) + (nodeBounds?.height ?? 420), frameBounds?.bottom ?? ((nodeBounds?.y ?? 0) + (nodeBounds?.height ?? 420)))
  const padding = 120
  return { x: left - padding, y: top - padding, width: Math.max(640, right - left + padding * 2), height: Math.max(420, bottom - top + padding * 2) }
}

function makeTransform(bounds: ReturnType<typeof projectBounds>, mapWidth: number, mapHeight: number): MapTransform {
  const scale = Math.min(mapWidth / bounds.width, mapHeight / bounds.height)
  return {
    worldX: bounds.x,
    worldY: bounds.y,
    worldWidth: bounds.width,
    worldHeight: bounds.height,
    scale,
    offsetX: (mapWidth - bounds.width * scale) / 2,
    offsetY: (mapHeight - bounds.height * scale) / 2,
  }
}

export function CanvasMiniMap({ nodes, workspaceFrames, camera, setCamera, collapsed, onCollapsedChange, onLocateContent, gridSnapEnabled = true, onGridSnapChange, navigationRequest }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; y: number; camera: Camera; scale: number } | null>(null)
  const [beaconNonce, setBeaconNonce] = useState<number | null>(null)
  const activeViewport = useActiveSpatialViewport()
  const viewport = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect() : undefined
  const viewportWidth = viewport?.width ?? 1400
  const viewportHeight = viewport?.height ?? 900
  const safeInsets = activeViewport && viewport
    ? spatialInsetsWithinRect(activeViewport, viewport)
    : { left: 0, right: 0, top: 0, bottom: 0 }
  const bounds = useMemo(() => projectBounds(nodes, workspaceFrames), [nodes, workspaceFrames])
  const mapWidth = 152
  const mapHeight = 76
  const transform = useMemo(() => makeTransform(bounds, mapWidth, mapHeight), [bounds])
  const worldToMapX = (x: number) => transform.offsetX + (x - transform.worldX) * transform.scale
  const worldToMapY = (y: number) => transform.offsetY + (y - transform.worldY) * transform.scale
  const mapToWorld = (x: number, y: number) => ({
    x: transform.worldX + (x - transform.offsetX) / transform.scale,
    y: transform.worldY + (y - transform.offsetY) / transform.scale,
  })
  const viewportCenter = {
    x: safeInsets.left + (viewportWidth - safeInsets.left - safeInsets.right) / 2,
    y: safeInsets.top + (viewportHeight - safeInsets.top - safeInsets.bottom) / 2,
  }
  const fitContent = () => {
    if (onLocateContent) { onLocateContent(); return }
    const contentBounds = restorationFocusBounds(nodes) ?? getSelectionBounds(nodes, nodes.map((node) => node.id))
    if (contentBounds) setCamera(fitBoundsForReading(contentBounds, viewportWidth, viewportHeight, 72, safeInsets))
  }
  const stepZoom = (delta: number) => setCamera((current) => zoomCameraAt(current, current.zoom + delta, viewportCenter.x, viewportCenter.y))
  const resetZoom = () => setCamera((current) => zoomCameraAt(current, 1, viewportCenter.x, viewportCenter.y))
  const viewWorld = cameraSafeViewportBounds(camera, viewportWidth, viewportHeight, safeInsets)

  useEffect(() => {
    if (!navigationRequest) { setBeaconNonce(null); return }
    setBeaconNonce(navigationRequest.nonce)
    const timer = window.setTimeout(() => setBeaconNonce((current) => current === navigationRequest.nonce ? null : current), 900)
    return () => window.clearTimeout(timer)
  }, [navigationRequest?.nonce])

  const activeBeaconIds = beaconNonce === navigationRequest?.nonce ? new Set(navigationRequest?.ids ?? []) : new Set<string>()
  const safeStyle = {
    '--lcos-minimap-safe-right': `${safeInsets.right}px`,
    '--lcos-minimap-safe-bottom': `${safeInsets.bottom}px`,
  } as CSSProperties

  if (collapsed) return <section className="minimap minimap-collapsed" style={safeStyle}><button aria-label="展开小地图" onClick={() => onCollapsedChange(false)}><Maximize2 size={13} /></button></section>

  return <section className="minimap" style={safeStyle} data-testid="project-minimap" data-node-count={nodes.length} data-frame-count={workspaceFrames.length}>
    <div className="map-label">当前画布地图 <span>{nodes.length} 个视图 <button className="map-collapse" aria-label="收起小地图" onClick={() => onCollapsedChange(true)}>−</button></span></div>
    <div ref={mapRef} className="map" data-testid="minimap-map"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const localY = event.clientY - rect.top
        const target = event.target as HTMLElement
        if (target.dataset.cameraRect === 'true') {
          drag.current = { x: event.clientX, y: event.clientY, camera, scale: transform.scale }
        } else {
          const world = mapToWorld(localX, localY)
          const located = { ...camera, x: viewportCenter.x - world.x * camera.zoom, y: viewportCenter.y - world.y * camera.zoom }
          setCamera(located)
          drag.current = { x: event.clientX, y: event.clientY, camera: located, scale: transform.scale }
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const dxWorld = (event.clientX - drag.current.x) / drag.current.scale
        const dyWorld = (event.clientY - drag.current.y) / drag.current.scale
        setCamera({ ...drag.current.camera, x: drag.current.camera.x - dxWorld * drag.current.camera.zoom, y: drag.current.camera.y - dyWorld * drag.current.camera.zoom })
      }}
      onPointerUp={(event) => {
        drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={(event) => {
        drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}>
      {workspaceFrames.map((frame) => <span key={frame.workspaceId} data-minimap-workspace-frame={frame.workspaceId} className={frame.active ? 'map-workspace active' : 'map-workspace'} style={{ left: worldToMapX(frame.bounds.x), top: worldToMapY(frame.bounds.y), width: frame.bounds.width * transform.scale, height: frame.bounds.height * transform.scale }} />)}
      {nodes.map((node) => <i key={node.id} data-testid={`minimap-node-${node.id}`} data-minimap-node-id={node.id} data-minimap-view-id={node.id} data-minimap-artifact-id={node.artifactId ?? ''} data-minimap-scope-id={node.scopeId ?? 'scope-root'} data-minimap-visible="true" data-minimap-kind={miniMapVisualKindForNode(node)} data-minimap-beacon={activeBeaconIds.has(node.id) || undefined} title={node.title} style={{ left: worldToMapX(node.x), top: worldToMapY(node.y), width: Math.max(3, node.width * transform.scale), height: Math.max(2, node.height * transform.scale) }} />)}
      <b data-camera-rect="true" data-testid="minimap-camera-rect" style={{ left: worldToMapX(viewWorld.x), top: worldToMapY(viewWorld.y), width: viewWorld.width * transform.scale, height: viewWorld.height * transform.scale }} />
    </div>
    <div className="map-controls"><button aria-label="缩小画布 5%" onClick={() => stepZoom(-CANVAS_ZOOM_STEP)}><Minus size={13} /></button><button className="map-zoom-value" aria-label="恢复 100% 缩放" title="恢复 100%" onClick={resetZoom}>{Math.round(camera.zoom * 100)}%</button><button aria-label="放大画布 5%" onClick={() => stepZoom(CANVAS_ZOOM_STEP)}><Plus size={13} /></button>{onGridSnapChange && <button className={`map-grid-snap ${gridSnapEnabled ? 'active' : ''}`} aria-pressed={gridSnapEnabled} aria-label={gridSnapEnabled ? '关闭网格吸附' : '开启网格吸附'} title={gridSnapEnabled ? '网格吸附已开启' : '开启网格吸附'} onClick={() => onGridSnapChange(!gridSnapEnabled)}><Grid3X3 size={12} /></button>}<button className="map-fit-content" aria-label="定位内容" title="定位内容" onClick={fitContent}><Maximize2 size={12} /></button></div>
  </section>
}
