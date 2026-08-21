import type { CanvasNode } from '../model'

/**
 * Region/Fence is temporary Presentation intent, not Project Truth and not a
 * child canvas. Persisting it as a Collection must be an explicit command.
 */
export interface SpatialRegionDraft {
  readonly id: string
  readonly memberViewIds: readonly string[]
  readonly bounds: { x: number; y: number; width: number; height: number }
  readonly label?: string
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
