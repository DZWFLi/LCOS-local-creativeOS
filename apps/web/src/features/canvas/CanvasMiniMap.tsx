import { useMemo, useRef } from 'react'
import type { Camera, CanvasNode, WorkspaceFrameVM } from '../../model'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { fitBounds, getSelectionBounds, type SafeInsets } from './canvasGeometry'

interface Props {
  nodes: CanvasNode[]
  workspaceFrames: WorkspaceFrameVM[]
  camera: Camera
  setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  safeInsets: SafeInsets
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

export function CanvasMiniMap({ nodes, workspaceFrames, camera, setCamera, collapsed, onCollapsedChange, safeInsets }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; y: number; camera: Camera; scale: number } | null>(null)
  const viewport = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect() : undefined
  const viewportWidth = viewport?.width ?? 1400
  const viewportHeight = viewport?.height ?? 900
  const bounds = useMemo(() => projectBounds(nodes, workspaceFrames), [nodes, workspaceFrames])
  const mapWidth = 166
  const mapHeight = 88
  const transform = useMemo(() => makeTransform(bounds, mapWidth, mapHeight), [bounds])
  const worldToMapX = (x: number) => transform.offsetX + (x - transform.worldX) * transform.scale
  const worldToMapY = (y: number) => transform.offsetY + (y - transform.worldY) * transform.scale
  const mapToWorld = (x: number, y: number) => ({
    x: transform.worldX + (x - transform.offsetX) / transform.scale,
    y: transform.worldY + (y - transform.offsetY) / transform.scale,
  })
  const fitContent = () => {
    const contentBounds = getSelectionBounds(nodes, nodes.map((node) => node.id))
    if (contentBounds) setCamera(fitBounds(contentBounds, viewportWidth, viewportHeight, 72, safeInsets))
  }
  const viewWorld = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    width: viewportWidth / camera.zoom,
    height: viewportHeight / camera.zoom,
  }

  if (collapsed) return <section className="minimap minimap-collapsed"><button aria-label="展开小地图" onClick={() => onCollapsedChange(false)}><Maximize2 size={13} /></button></section>

  return <section className="minimap" data-testid="project-minimap" data-node-count={nodes.length} data-frame-count={workspaceFrames.length}>
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
          setCamera({ ...camera, x: viewportWidth / 2 - world.x * camera.zoom, y: viewportHeight / 2 - world.y * camera.zoom })
          drag.current = { x: event.clientX, y: event.clientY, camera: { ...camera, x: viewportWidth / 2 - world.x * camera.zoom, y: viewportHeight / 2 - world.y * camera.zoom }, scale: transform.scale }
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
      {nodes.map((node) => <i key={node.id} data-minimap-node-id={node.id} data-minimap-view-id={node.id} data-minimap-artifact-id={node.artifactId ?? ''} data-minimap-scope-id={node.scopeId ?? 'scope-root'} data-minimap-visible="true" title={`${node.id} / ${node.scopeId ?? 'scope-root'}`} style={{ left: worldToMapX(node.x), top: worldToMapY(node.y), width: Math.max(3, node.width * transform.scale), height: Math.max(2, node.height * transform.scale) }} />)}
      <b data-camera-rect="true" data-testid="minimap-camera-rect" style={{ left: worldToMapX(viewWorld.x), top: worldToMapY(viewWorld.y), width: viewWorld.width * transform.scale, height: viewWorld.height * transform.scale }} />
    </div>
    <div className="map-controls"><button aria-label="缩小画布" onClick={() => setCamera((current) => ({ ...current, zoom: Math.max(.01, current.zoom - .1) }))}><Minus size={13} /></button><span>{Math.round(camera.zoom * 100)}%</span><button aria-label="放大画布" onClick={() => setCamera((current) => ({ ...current, zoom: Math.min(1.8, current.zoom + .1) }))}><Plus size={13} /></button><button className="map-fit-content" aria-label="定位内容" title="定位内容" onClick={fitContent}><Maximize2 size={12} /></button></div>
  </section>
}
