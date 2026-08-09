import type { Camera, CanvasNode, NodeDisplayMode } from '../../model'

export interface Bounds { x: number; y: number; width: number; height: number }
export interface WheelGesture { deltaX: number; deltaY: number; zoom: boolean; anchorX: number; anchorY: number; precision?: boolean }
export interface SafeInsets { left: number; right: number; top: number; bottom: number }
type BoundedNode = { x: number; y: number; width: number; height: number }

const TOUCHPAD_PAN_SENSITIVITY = 0.5
const WHEEL_ZOOM_SENSITIVITY = 0.0035
const PRECISION_ZOOM_MULTIPLIER = 0.35
export const MIN_CANVAS_ZOOM = 0.02
export const MAX_CANVAS_ZOOM = 2
export const CANVAS_ZOOM_STEP = 0.05
export const MIN_RESTORED_CAMERA_CONTENT_RATIO = 0.5
export const MIN_RESTORED_CAMERA_READABLE_RATIO = 0.34
export const MIN_RESTORED_NODE_SCREEN_WIDTH = 112
export const MIN_RESTORED_CAMERA_ZOOM = 0.58
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

function boundsForNodes(nodes: readonly BoundedNode[]): Bounds {
  const left = Math.min(...nodes.map((node) => node.x))
  const top = Math.min(...nodes.map((node) => node.y))
  const right = Math.max(...nodes.map((node) => node.x + node.width))
  const bottom = Math.max(...nodes.map((node) => node.y + node.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function gapBetween(a: BoundedNode, b: BoundedNode): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  return Math.hypot(dx, dy)
}

/**
 * 从过度分散的项目总览中找出最密集的内容邻域。并列时保留数据顺序，
 * 让 Project 的主要/较早对象优先，而不是落到多个岛之间的空白几何中心。
 */
export function restorationFocusBounds(nodes: readonly BoundedNode[], neighborhoodGap = 720): Bounds | null {
  if (nodes.length === 0) return null
  const visited = new Set<number>()
  let best: number[] = []
  for (let seed = 0; seed < nodes.length; seed += 1) {
    if (visited.has(seed)) continue
    const component: number[] = []
    const queue = [seed]
    visited.add(seed)
    while (queue.length) {
      const current = queue.shift()
      if (current === undefined) break
      component.push(current)
      for (let candidate = 0; candidate < nodes.length; candidate += 1) {
        if (visited.has(candidate) || gapBetween(nodes[current], nodes[candidate]) > neighborhoodGap) continue
        visited.add(candidate)
        queue.push(candidate)
      }
    }
    if (component.length > best.length) best = component
  }
  return boundsForNodes(best.map((index) => nodes[index]))
}

/**
 * 初次进入内容现场时，在“尽量看全”和“至少看得清”之间取平衡。
 * 普通 fitBounds 保留 2% 超大画布总览能力；只有恢复失效相机时才使用这个阅读下限。
 */
export function fitBoundsForReading(bounds: Bounds, viewportWidth: number, viewportHeight: number, padding = 74, insets: SafeInsets = NO_INSETS): Camera {
  const fitted = fitBounds(bounds, viewportWidth, viewportHeight, padding, insets)
  if (fitted.zoom >= MIN_RESTORED_CAMERA_ZOOM) return fitted
  const anchorX = insets.left + Math.max(1, viewportWidth - insets.left - insets.right) / 2
  const anchorY = insets.top + Math.max(1, viewportHeight - insets.top - insets.bottom) / 2
  return zoomCameraAt(fitted, MIN_RESTORED_CAMERA_ZOOM, anchorX, anchorY)
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

/** 恢复相机不仅要“碰到”内容，还要让足够多的内容达到可辨认尺寸。 */
export function restoredCameraIsMeaningful(camera: Camera, nodes: readonly { x: number; y: number; width: number; height: number }[], viewportWidth: number, viewportHeight: number): boolean {
  if (nodes.length === 0) return false
  let readable = 0
  for (const node of nodes) {
    const left = camera.x + node.x * camera.zoom
    const right = camera.x + (node.x + node.width) * camera.zoom
    const top = camera.y + node.y * camera.zoom
    const bottom = camera.y + (node.y + node.height) * camera.zoom
    const visible = right > 0 && left < viewportWidth && bottom > 0 && top < viewportHeight
    if (visible && node.width * camera.zoom >= MIN_RESTORED_NODE_SCREEN_WIDTH) readable += 1
  }
  return camera.zoom >= MIN_RESTORED_CAMERA_ZOOM
    && readable / nodes.length >= MIN_RESTORED_CAMERA_READABLE_RATIO
    && cameraContentRatio(camera, nodes, viewportWidth, viewportHeight) >= MIN_RESTORED_CAMERA_READABLE_RATIO
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

/** 相机在未被 Shell 遮挡的安全工作区内实际覆盖的世界坐标范围。 */
export function cameraSafeViewportBounds(camera: Camera, viewportWidth: number, viewportHeight: number, insets: SafeInsets = NO_INSETS): Bounds {
  return {
    x: (insets.left - camera.x) / camera.zoom,
    y: (insets.top - camera.y) / camera.zoom,
    width: Math.max(1, viewportWidth - insets.left - insets.right) / camera.zoom,
    height: Math.max(1, viewportHeight - insets.top - insets.bottom) / camera.zoom,
  }
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
