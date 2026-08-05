import type { Camera, CanvasNode, NodeDisplayMode } from '../../model'

export interface Bounds { x: number; y: number; width: number; height: number }
export interface WheelGesture { deltaX: number; deltaY: number; zoom: boolean; anchorX: number; anchorY: number; precision?: boolean }
export interface SafeInsets { left: number; right: number; top: number; bottom: number }

const TOUCHPAD_PAN_SENSITIVITY = 0.5
const WHEEL_ZOOM_SENSITIVITY = 0.0035
const PRECISION_ZOOM_MULTIPLIER = 0.35
export const MIN_CANVAS_ZOOM = 0.25
export const MAX_CANVAS_ZOOM = 2
export const CANVAS_ZOOM_STEP = 0.05
export const MIN_RESTORED_CAMERA_CONTENT_RATIO = 0.5
const NO_INSETS: SafeInsets = { left: 0, right: 0, top: 0, bottom: 0 }

export function zoomCameraAt(camera: Camera, zoom: number, anchorX: number, anchorY: number): Camera {
  const nextZoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, zoom))
  const worldX = (anchorX - camera.x) / camera.zoom
  const worldY = (anchorY - camera.y) / camera.zoom
  return { x: anchorX - worldX * nextZoom, y: anchorY - worldY * nextZoom, zoom: nextZoom }
}

export function applyWheelGesture(camera: Camera, gesture: WheelGesture): Camera {
  if (!gesture.zoom) return { ...camera, x: camera.x - gesture.deltaX * TOUCHPAD_PAN_SENSITIVITY, y: camera.y - gesture.deltaY * TOUCHPAD_PAN_SENSITIVITY }
  const sensitivity = WHEEL_ZOOM_SENSITIVITY * (gesture.precision ? PRECISION_ZOOM_MULTIPLIER : 1)
  return zoomCameraAt(camera, camera.zoom * Math.exp(-gesture.deltaY * sensitivity), gesture.anchorX, gesture.anchorY)
}

export function getSelectionBounds(nodes: CanvasNode[], selectedIds: string[]): Bounds | null {
  const selected = nodes.filter((node) => selectedIds.includes(node.id))
  if (!selected.length) return null
  const left = Math.min(...selected.map((node) => node.x))
  const top = Math.min(...selected.map((node) => node.y))
  const right = Math.max(...selected.map((node) => node.x + node.width))
  const bottom = Math.max(...selected.map((node) => node.y + node.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function fitBounds(bounds: Bounds, viewportWidth: number, viewportHeight: number, padding = 74, insets: SafeInsets = NO_INSETS): Camera {
  const availableWidth = Math.max(1, viewportWidth - insets.left - insets.right)
  const availableHeight = Math.max(1, viewportHeight - insets.top - insets.bottom)
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, Math.min((availableWidth - padding * 2) / Math.max(1, bounds.width), (availableHeight - padding * 2) / Math.max(1, bounds.height))))
  return {
    x: insets.left + availableWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: insets.top + availableHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  }
}

/** 判断某相机下是否存在至少一个节点落在视口内（用于校验持久化相机是否仍有效）。 */
export function cameraSeesAnyNode(camera: Camera, nodes: readonly { x: number; y: number; width: number; height: number }[], viewportWidth: number, viewportHeight: number): boolean {
  return nodes.some((node) => {
    const left = camera.x + node.x * camera.zoom
    const right = camera.x + (node.x + node.width) * camera.zoom
    const top = camera.y + node.y * camera.zoom
    const bottom = camera.y + (node.y + node.height) * camera.zoom
    return right > 0 && left < viewportWidth && bottom > 0 && top < viewportHeight
  })
}

/** 内容节点与视口相交的比例（用于判断持久化相机是否仍能有效展示内容）。 */
export function cameraContentRatio(camera: Camera, nodes: readonly { x: number; y: number; width: number; height: number }[], viewportWidth: number, viewportHeight: number): number {
  if (nodes.length === 0) return 0
  let visible = 0
  for (const node of nodes) {
    const left = camera.x + node.x * camera.zoom
    const right = camera.x + (node.x + node.width) * camera.zoom
    const top = camera.y + node.y * camera.zoom
    const bottom = camera.y + (node.y + node.height) * camera.zoom
    if (right > 0 && left < viewportWidth && bottom > 0 && top < viewportHeight) visible += 1
  }
  return visible / nodes.length
}

export function revealNode(camera: Camera, node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, viewportWidth: number, viewportHeight: number, margins: SafeInsets = { left: 250, right: 42, top: 70, bottom: 56 }): Camera {
  const left = camera.x + node.x * camera.zoom
  const right = camera.x + (node.x + node.width) * camera.zoom
  const top = camera.y + node.y * camera.zoom
  const bottom = camera.y + (node.y + node.height) * camera.zoom
  let x = camera.x
  let y = camera.y
  if (right > viewportWidth - margins.right) x -= right - (viewportWidth - margins.right)
  if (left < margins.left) x += margins.left - left
  if (bottom > viewportHeight - margins.bottom) y -= bottom - (viewportHeight - margins.bottom)
  if (top < margins.top) y += margins.top - top
  return { ...camera, x, y }
}

export function nodeDensity(node: CanvasNode, lod: 'full' | 'simplified' | 'overview'): NodeDisplayMode {
  if (lod !== 'full') return 'compact'
  return node.displayMode ?? inferLegacyDisplayMode(node)
}

export function nodeDimensions(kind: CanvasNode['kind'], mode: NodeDisplayMode): { width: number; height: number } {
  if (kind === 'process') return mode === 'compact' ? { width: 190, height: 66 } : mode === 'expanded' ? { width: 280, height: 108 } : { width: 238, height: 82 }
  if (kind === 'decision') return mode === 'compact' ? { width: 205, height: 82 } : mode === 'expanded' ? { width: 292, height: 142 } : { width: 252, height: 114 }
  if (kind === 'context') return mode === 'compact' ? { width: 190, height: 90 } : mode === 'expanded' ? { width: 286, height: 178 } : { width: 236, height: 144 }
  if (kind === 'note') return mode === 'compact' ? { width: 180, height: 78 } : mode === 'expanded' ? { width: 260, height: 136 } : { width: 218, height: 110 }
  return mode === 'compact' ? { width: 196, height: 108 } : mode === 'expanded' ? { width: 320, height: 246 } : { width: 264, height: 190 }
}

function inferLegacyDisplayMode(node: CanvasNode): NodeDisplayMode {
  if (node.width < 205 || node.height < 100) return 'compact'
  if (node.width >= 300 || node.height >= 220) return 'expanded'
  return 'standard'
}
