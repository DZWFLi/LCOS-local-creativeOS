import type { PresentationSpatialRegionV0 } from '@local-creative-os/contracts'
import type { CanvasNode } from '../model'

/**
 * Region/Fence is durable Presentation geometry, not Project Truth and not a
 * child canvas. Membership is derived live from geometry; promoting the current
 * members into a semantic Collection remains an explicit command.
 */
export interface SpatialRegionDraft extends PresentationSpatialRegionV0 {
  readonly memberViewIds: readonly string[]
}

export function spatialRegionFromSelection(id: string, memberViewIds: readonly string[], nodes: readonly CanvasNode[], padding = 28): SpatialRegionDraft | null {
  const selected = nodes.filter((node) => memberViewIds.includes(node.id))
  if (selected.length === 0) return null
  const left = Math.min(...selected.map((node) => node.x)) - padding
  const top = Math.min(...selected.map((node) => node.y)) - padding
  const right = Math.max(...selected.map((node) => node.x + node.width)) + padding
  const bottom = Math.max(...selected.map((node) => node.y + node.height)) + padding
  return {
    id,
    memberViewIds: [...new Set(selected.map((node) => node.id))],
    bounds: { x: left, y: top, width: right - left, height: bottom - top },
  }
}
