import type { Camera } from '../../model'
import type { SpatialBounds, SpatialPoint } from './spatialTypes'

export function spatialBoundsIntersect(left: SpatialBounds, right: SpatialBounds): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

export function spatialWorldBoundsToScreen(bounds: SpatialBounds, camera: Camera, origin: SpatialPoint = { x: 0, y: 0 }): SpatialBounds {
  return {
    x: origin.x + camera.x + bounds.x * camera.zoom,
    y: origin.y + camera.y + bounds.y * camera.zoom,
    width: bounds.width * camera.zoom,
    height: bounds.height * camera.zoom,
  }
}

export function spatialIdsIntersectingScreenRect<T extends SpatialBounds & { id: string }>(items: readonly T[], screenRect: SpatialBounds, camera: Camera, origin: SpatialPoint = { x: 0, y: 0 }): string[] {
  return items.filter((item) => spatialBoundsIntersect(spatialWorldBoundsToScreen(item, camera, origin), screenRect)).map((item) => item.id)
}
