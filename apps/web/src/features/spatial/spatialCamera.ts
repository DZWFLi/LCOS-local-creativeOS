import type { Camera } from '../../model'
import type { SpatialBounds, SpatialInsets, SpatialPoint, SpatialSize } from './spatialTypes'

const TOUCHPAD_PAN_SENSITIVITY = 0.5
const WHEEL_ZOOM_SENSITIVITY = 0.0035
const PRECISION_ZOOM_MULTIPLIER = 0.35
export const MIN_SPATIAL_ZOOM = 0.02
export const MAX_SPATIAL_ZOOM = 2
const EMPTY_INSETS: SpatialInsets = { left: 0, right: 0, top: 0, bottom: 0 }

export interface SpatialWheelGesture {
  deltaX: number
  deltaY: number
  zoom: boolean
  anchorX: number
  anchorY: number
  precision?: boolean
}

export function zoomSpatialCameraAt(camera: Camera, zoom: number, anchorX: number, anchorY: number): Camera {
  const nextZoom = Math.max(MIN_SPATIAL_ZOOM, Math.min(MAX_SPATIAL_ZOOM, zoom))
  const worldX = (anchorX - camera.x) / camera.zoom
  const worldY = (anchorY - camera.y) / camera.zoom
  return { x: anchorX - worldX * nextZoom, y: anchorY - worldY * nextZoom, zoom: nextZoom }
}

export function applySpatialWheelGesture(camera: Camera, gesture: SpatialWheelGesture): Camera {
  if (!gesture.zoom) return { ...camera, x: camera.x - gesture.deltaX * TOUCHPAD_PAN_SENSITIVITY, y: camera.y - gesture.deltaY * TOUCHPAD_PAN_SENSITIVITY }
  const sensitivity = WHEEL_ZOOM_SENSITIVITY * (gesture.precision ? PRECISION_ZOOM_MULTIPLIER : 1)
  return zoomSpatialCameraAt(camera, camera.zoom * Math.exp(-gesture.deltaY * sensitivity), gesture.anchorX, gesture.anchorY)
}

export function spatialScreenToWorld(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top'>, camera: Camera): SpatialPoint {
  return { x: (clientX - rect.left - camera.x) / camera.zoom, y: (clientY - rect.top - camera.y) / camera.zoom }
}

export function spatialWorldToScreen(point: SpatialPoint, camera: Camera): SpatialPoint {
  return { x: camera.x + point.x * camera.zoom, y: camera.y + point.y * camera.zoom }
}

export function spatialCameraTransform(camera: Camera): string {
  return `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`
}

export function spatialViewportWorldBounds(camera: Camera, size: SpatialSize, overscanPx = 0): SpatialBounds {
  const overscan = overscanPx / Math.max(.2, camera.zoom)
  const x = -camera.x / camera.zoom - overscan
  const y = -camera.y / camera.zoom - overscan
  return {
    x,
    y,
    width: size.width / camera.zoom + overscan * 2,
    height: size.height / camera.zoom + overscan * 2,
  }
}

export function spatialBoundsForPlacements(placements: readonly SpatialBounds[], padding = 0): SpatialBounds {
  if (!placements.length) return { x: -padding, y: -padding, width: padding * 2 + 1, height: padding * 2 + 1 }
  const left = Math.min(...placements.map((item) => item.x)) - padding
  const top = Math.min(...placements.map((item) => item.y)) - padding
  const right = Math.max(...placements.map((item) => item.x + item.width)) + padding
  const bottom = Math.max(...placements.map((item) => item.y + item.height)) + padding
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

export function fitSpatialBounds(bounds: SpatialBounds, viewportWidth: number, viewportHeight: number, padding = 74, insets: SpatialInsets = EMPTY_INSETS): Camera {
  const availableWidth = Math.max(1, viewportWidth - insets.left - insets.right)
  const availableHeight = Math.max(1, viewportHeight - insets.top - insets.bottom)
  const zoom = Math.max(MIN_SPATIAL_ZOOM, Math.min(MAX_SPATIAL_ZOOM, Math.min((availableWidth - padding * 2) / Math.max(1, bounds.width), (availableHeight - padding * 2) / Math.max(1, bounds.height))))
  return {
    x: insets.left + availableWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: insets.top + availableHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  }
}

export function edgeScrollDelta(pointer: SpatialPoint, bounds: { left: number; right: number; top: number; bottom: number }, band: number, maxStep: number): SpatialPoint {
  const strength = (distance: number) => Math.min(1, Math.max(0, (band - distance) / band))
  const left = strength(pointer.x - bounds.left)
  const right = strength(bounds.right - pointer.x)
  const top = strength(pointer.y - bounds.top)
  const bottom = strength(bounds.bottom - pointer.y)
  return { x: (left - right) * maxStep, y: (top - bottom) * maxStep }
}
