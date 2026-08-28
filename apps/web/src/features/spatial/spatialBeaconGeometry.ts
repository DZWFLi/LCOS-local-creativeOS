import type { Camera } from '../../model'
import type { SpatialFocusItem } from './useSpatialFocusRequest'

export interface SpatialBeaconProjection {
  readonly x: number
  readonly y: number
  readonly angleRad: number
  readonly offscreen: boolean
}

/**
 * Projects a world target into the Beacon overlay. Offscreen targets are clamped
 * to the viewport edge along the true direction from viewport center; this is
 * Presentation-only geometry and never changes Selection/Membership.
 */
export function projectSpatialBeacon(
  target: SpatialFocusItem,
  camera: Camera,
  viewport: { readonly width: number; readonly height: number },
  margin = 30,
): SpatialBeaconProjection {
  const centerX = target.x + target.width / 2
  const centerY = target.y + target.height / 2
  const screenX = camera.x + centerX * camera.zoom
  const screenY = camera.y + centerY * camera.zoom
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const safeMargin = Math.max(0, Math.min(margin, width / 2 - 1, height / 2 - 1))
  const inside = screenX >= safeMargin && screenX <= width - safeMargin && screenY >= safeMargin && screenY <= height - safeMargin
  const viewportCenterX = width / 2
  const viewportCenterY = height / 2
  const dx = screenX - viewportCenterX
  const dy = screenY - viewportCenterY
  const angleRad = Math.atan2(dy, dx)
  if (inside) return { x: screenX, y: screenY, angleRad, offscreen: false }

  const halfW = Math.max(1, width / 2 - safeMargin)
  const halfH = Math.max(1, height / 2 - safeMargin)
  const tx = Math.abs(dx) > 0.0001 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY
  const ty = Math.abs(dy) > 0.0001 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY
  const t = Math.min(tx, ty)
  if (!Number.isFinite(t)) return { x: viewportCenterX, y: viewportCenterY, angleRad: 0, offscreen: true }
  return {
    x: viewportCenterX + dx * t,
    y: viewportCenterY + dy * t,
    angleRad,
    offscreen: true,
  }
}
