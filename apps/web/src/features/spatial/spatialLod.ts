import type { Camera } from '../../model'
import { spatialViewportWorldBounds } from './spatialCamera'
import type { SpatialDensity, SpatialLod, SpatialPlacement, SpatialSize } from './spatialTypes'

/** Shared semantic LOD contract. Renderers may simplify anatomy, never change Project Truth. */
export function spatialLodForCount(count: number): SpatialLod {
  return count >= 300 ? 'overview' : count > 150 ? 'aggregate' : count > 80 ? 'simplified' : 'full'
}

/** Viewport density is a sidecar/overlay concern, independent from graph semantics. */
export function spatialDensityForSize(size: SpatialSize): SpatialDensity {
  if (size.width < 520 || size.height < 460) return 'constrained'
  if (size.width < 760 || size.height < 620) return 'compact'
  return 'comfortable'
}

/**
 * Camera-local overview projection. Complete membership, minimap items and
 * persisted positions stay untouched; selected objects are never discarded.
 */
export function spatialOverviewProjection<T extends SpatialPlacement>(
  items: readonly T[],
  camera: Camera,
  keepIds: ReadonlySet<string>,
  viewport: SpatialSize = { width: 1440, height: 900 },
  limit = 180,
): T[] {
  if (items.length < 48) return [...items]
  const world = spatialViewportWorldBounds(camera, viewport, 320)
  const right = world.x + world.width
  const bottom = world.y + world.height
  const candidates = items.filter((item) => keepIds.has(item.id)
    || (item.x < right && item.x + item.width > world.x && item.y < bottom && item.y + item.height > world.y))
  if (spatialLodForCount(items.length) !== 'overview' || candidates.length <= limit) return candidates
  const kept = candidates.filter((item) => keepIds.has(item.id))
  const rest = candidates.filter((item) => !keepIds.has(item.id))
  const available = Math.max(1, limit - kept.length)
  const stride = Math.max(1, Math.ceil(rest.length / available))
  return [...kept, ...rest.filter((_, index) => index % stride === 0)].slice(0, Math.max(limit, kept.length))
}
