import type { CanvasNode } from '../../model'
import { visibleHierarchyRows, type PresentationHierarchyState } from './presentationHierarchy'

export interface MindMapPlacement {
  id: string
  node: CanvasNode
  x: number
  y: number
  width: number
  height: number
  parentId: string | null
  side: -1 | 1
  branch: number
  depth: number
  hasChildren: boolean
}

export interface MindMapLayout {
  placements: MindMapPlacement[]
  rootCenter: { x: number; y: number; width: number; height: number }
  width: number
  height: number
}

const NODE_WIDTH = 188
const NODE_HEIGHT = 48
const ROOT_WIDTH = 196
const ROOT_HEIGHT = 48
const ROOT_GAP = 128
const LEVEL_GAP = 224
const LEAF_GAP = 26

export function layoutMindMap(nodes: readonly CanvasNode[], state: PresentationHierarchyState, width = 1320, height = 820): MindMapLayout {
  const rows = visibleHierarchyRows(nodes, state)
  const byId = new Map(rows.map((row) => [row.id, row]))
  const children = new Map<string | null, string[]>()
  rows.forEach((row) => children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]))
  const roots = children.get(null) ?? []
  const rootCenter = { x: width / 2 - ROOT_WIDTH / 2, y: height / 2 - ROOT_HEIGHT / 2, width: ROOT_WIDTH, height: ROOT_HEIGHT }
  if (!roots.length) return { placements: [], rootCenter, width, height }

  const sideByRoot = new Map<string, -1 | 1>()
  roots.forEach((id, index) => sideByRoot.set(id, index % 2 === 0 ? 1 : -1))
  const rootOf = new Map<string, string>()
  const assignRoot = (id: string, rootId: string) => {
    rootOf.set(id, rootId)
    ;(children.get(id) ?? []).forEach((child) => assignRoot(child, rootId))
  }
  roots.forEach((id) => assignRoot(id, id))

  const weightCache = new Map<string, number>()
  const weight = (id: string): number => {
    const cached = weightCache.get(id)
    if (cached !== undefined) return cached
    const childIds = children.get(id) ?? []
    const value = childIds.length ? childIds.reduce((sum, child) => sum + weight(child), 0) : 1
    weightCache.set(id, value)
    return value
  }

  const yById = new Map<string, number>()
  const placeSubtree = (id: string, top: number, unit: number) => {
    const childIds = children.get(id) ?? []
    if (!childIds.length) { yById.set(id, top + unit / 2 - NODE_HEIGHT / 2); return }
    let cursor = top
    childIds.forEach((child) => {
      const childHeight = weight(child) * unit
      placeSubtree(child, cursor, unit)
      cursor += childHeight
    })
    const first = yById.get(childIds[0]!) ?? top
    const last = yById.get(childIds[childIds.length - 1]!) ?? top
    yById.set(id, (first + last) / 2)
  }

  ;([-1, 1] as const).forEach((side) => {
    const sideRoots = roots.filter((id) => sideByRoot.get(id) === side)
    if (!sideRoots.length) return
    const totalWeight = sideRoots.reduce((sum, id) => sum + weight(id), 0)
    const totalHeight = Math.min(height - 120, Math.max(NODE_HEIGHT, totalWeight * (NODE_HEIGHT + LEAF_GAP)))
    const unit = totalHeight / Math.max(1, totalWeight)
    let cursor = height / 2 - totalHeight / 2
    sideRoots.forEach((id) => {
      const subtreeHeight = weight(id) * unit
      placeSubtree(id, cursor, unit)
      cursor += subtreeHeight
    })
  })

  const placements = rows.map((row) => {
    const rootId = rootOf.get(row.id) ?? row.id
    const side = sideByRoot.get(rootId) ?? 1
    const depth = row.depth
    const distance = ROOT_GAP + depth * LEVEL_GAP
    const x = side > 0 ? rootCenter.x + ROOT_WIDTH + distance : rootCenter.x - distance - NODE_WIDTH
    return {
      id: row.id,
      node: byId.get(row.id)!.node,
      x,
      y: yById.get(row.id) ?? height / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      parentId: row.parentId,
      side,
      branch: roots.indexOf(rootId),
      depth,
      hasChildren: row.hasChildren,
    }
  })
  return { placements, rootCenter, width, height }
}

export function mindMapEdgePath(from: { x: number; y: number; width: number; height: number }, to: MindMapPlacement) {
  const startX = to.side > 0 ? from.x + from.width : from.x
  const startY = from.y + from.height / 2
  const endX = to.side > 0 ? to.x : to.x + to.width
  const endY = to.y + to.height / 2
  const middleX = startX + (endX - startX) * .5
  return `M ${startX} ${startY} L ${middleX} ${startY} Q ${middleX} ${endY} ${endX} ${endY}`
}
