import type { SpatialDensity, SpatialLod, SpatialSize } from './spatialTypes'

/** Shared semantic LOD contract. Renderers may simplify anatomy, never change Project Truth. */
export function spatialLodForCount(count: number): SpatialLod {
  return count >= 300 ? 'overview' : count >= 150 ? 'simplified' : 'full'
}

/** Viewport density is a sidecar/overlay concern, independent from graph semantics. */
export function spatialDensityForSize(size: SpatialSize): SpatialDensity {
  if (size.width < 520 || size.height < 460) return 'constrained'
  if (size.width < 760 || size.height < 620) return 'compact'
  return 'comfortable'
}
