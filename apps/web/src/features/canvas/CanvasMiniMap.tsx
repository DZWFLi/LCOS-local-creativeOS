import { useRef } from 'react'
import type { Camera, CanvasNode } from '../../model'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { fitBounds, getSelectionBounds, type SafeInsets } from './canvasGeometry'

interface Props {
  nodes: CanvasNode[]
  camera: Camera
  setCamera: (camera: Camera) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  safeInsets: SafeInsets
}

export function CanvasMiniMap({ nodes, camera, setCamera, collapsed, onCollapsedChange, safeInsets }: Props) {
  const scale = .14
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const viewport = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect() : undefined
  const viewportWidth = viewport?.width ?? 1400
  const viewportHeight = viewport?.height ?? 900
  const visible = nodes.some((node) => {
    const left = -camera.x / camera.zoom
    const top = -camera.y / camera.zoom
    const right = left + viewportWidth / camera.zoom
    const bottom = top + viewportHeight / camera.zoom
    return node.x < right && node.x + node.width > left && node.y < bottom && node.y + node.height > top
  })
  const fitContent = () => {
    const bounds = getSelectionBounds(nodes, nodes.map((node) => node.id))
    if (bounds) setCamera(fitBounds(bounds, viewportWidth, viewportHeight, 72, safeInsets))
  }

  if (collapsed) return <section className="minimap minimap-collapsed"><button aria-label="展开小地图" onClick={() => onCollapsedChange(false)}><Maximize2 size={13} /></button></section>

  return <section className={`minimap ${!visible ? 'content-lost' : ''}`}>
    <div className="map-label">画布 <span>物理位置 <button className="map-collapse" aria-label="收起小地图" onClick={() => onCollapsedChange(true)}>−</button></span></div>
    <div className="map"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        drag.current = { x: event.clientX, y: event.clientY, camera }
        const targetX = (event.clientX - rect.left) / scale
        const targetY = (event.clientY - rect.top) / scale
        setCamera({ ...camera, x: rect.width / 2 - targetX * camera.zoom, y: rect.height / 2 - targetY * camera.zoom })
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        setCamera({ ...camera, x: drag.current.camera.x - (event.clientX - drag.current.x) / scale * camera.zoom, y: drag.current.camera.y - (event.clientY - drag.current.y) / scale * camera.zoom })
      }}
      onPointerUp={() => { drag.current = null }}>
      {nodes.map((node) => <i key={node.id} style={{ left: node.x * scale, top: node.y * scale, width: Math.max(6, node.width * scale), height: Math.max(4, node.height * scale) }} />)}
      <b style={{ left: (-camera.x / camera.zoom) * scale, top: (-camera.y / camera.zoom) * scale, width: viewportWidth * scale / camera.zoom, height: viewportHeight * scale / camera.zoom }} />
    </div>
    {!visible && <button className="map-locate" onClick={fitContent}><Maximize2 size={13} /> 定位内容</button>}
    <div className="map-controls"><button onClick={() => setCamera({ ...camera, zoom: Math.max(.4, camera.zoom - .1) })}><Minus size={13} /></button><span>{Math.round(camera.zoom * 100)}%</span><button onClick={() => setCamera({ ...camera, zoom: Math.min(1.5, camera.zoom + .1) })}><Plus size={13} /></button><button aria-label="适配全部内容" onClick={fitContent}><Maximize2 size={12} /></button></div>
  </section>
}
