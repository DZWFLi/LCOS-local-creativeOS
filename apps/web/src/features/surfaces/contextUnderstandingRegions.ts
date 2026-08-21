import type { PresentationHierarchyState } from '../presentation/presentationHierarchy'
import type { CanvasNode } from '../../model'

export interface ContextPlacementLike {
  readonly node: CanvasNode
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ContextUnderstandingRegion {
  readonly id: string
  readonly rootId: string
  readonly label: string
  readonly memberIds: readonly string[]
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Project the persisted Context hierarchy into lightweight reading regions.
 *
 * The region is deliberately derived Presentation: it does not create a new
 * Project Entity, Relation or Context membership. Structure remains editable
 * in the Structure lens; Space only makes that structure legible while the
 * user reads real materials.
 */
export function contextUnderstandingRegions(
  hierarchy: PresentationHierarchyState,
  placements: readonly ContextPlacementLike[],
  padding = 26,
): readonly ContextUnderstandingRegion[] {
  if (placements.length < 2) return []
  const placementById = new Map(placements.map((item) => [item.node.id, item]))
  const order = hierarchy.orderIds.filter((id) => placementById.has(id))
  if (order.length < 2) return []

  const roots: Array<{ id: string; start: number; end: number }> = []
  for (let index = 0; index < order.length; index += 1) {
    const id = order[index]!
    if ((hierarchy.depthById[id] ?? 0) !== 0) continue
    if (roots.length) roots[roots.length - 1]!.end = index
    roots.push({ id, start: index, end: order.length })
  }
  if (!roots.length) return []

  return roots.flatMap((root) => {
    const memberIds = order.slice(root.start, root.end)
    // A single root without children is not a region; drawing boxes around
    // every item would turn Context back into taxonomy chrome.
    if (memberIds.length < 2) return []
    const members = memberIds.flatMap((id) => {
      const item = placementById.get(id)
      return item ? [item] : []
    })
    if (members.length < 2) return []
    const minX = Math.min(...members.map((item) => item.x))
    const minY = Math.min(...members.map((item) => item.y))
    const maxX = Math.max(...members.map((item) => item.x + item.width))
    const maxY = Math.max(...members.map((item) => item.y + item.height))
    const rootNode = placementById.get(root.id)?.node
    return [{
      id: `context-region:${root.id}`,
      rootId: root.id,
      label: rootNode?.title || '理解区域',
      memberIds,
      x: minX - padding,
      y: minY - padding - 16,
      width: Math.max(120, maxX - minX + padding * 2),
      height: Math.max(84, maxY - minY + padding * 2 + 16),
    } satisfies ContextUnderstandingRegion]
  })
}
