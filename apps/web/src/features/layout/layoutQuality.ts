import type { LayoutEdgeInput, LayoutNodeInput, LayoutPoint, LayoutPosition } from './layoutTypes'

/**
 * Phase 2 §5.4：布局质量指标（纯几何，不依赖视觉）。
 * - edgeCrossings：直连线段两两相交数（共享端点不计）
 * - backwardEdges：目标中心在源中心左侧（或同列但更低）的有向边数
 * - totalEdgeLength：所有边中心距之和
 * - overlappingNodes：矩形相交的节点对数
 * - pinnedNodeDrift：被钉住节点从原始位置移动的欧氏距离之和
 */
export interface LayoutQuality {
  readonly edgeCrossings: number
  readonly backwardEdges: number
  readonly totalEdgeLength: number
  readonly overlappingNodes: number
  readonly pinnedNodeDrift: number
}

interface QualityInput {
  readonly nodes: readonly LayoutNodeInput[]
  readonly edges: readonly LayoutEdgeInput[]
  readonly positions: readonly LayoutPosition[]
}

function centerOf(node: LayoutNodeInput, position: LayoutPosition): LayoutPoint {
  return { x: position.x + node.width / 2, y: position.y + node.height / 2 }
}

function orientation(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

function segmentsCross(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint, d: LayoutPoint): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    // 共线：共享端点不算交叉，真重叠（跨过中点）才算。
    const share = (p: LayoutPoint, q: LayoutPoint) => p.x === q.x && p.y === q.y
    if (share(a, c) || share(a, d) || share(b, c) || share(b, d)) return false
    const midC = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
    return Math.min(a.x, b.x) <= midC.x && midC.x <= Math.max(a.x, b.x)
      && Math.min(a.y, b.y) <= midC.y && midC.y <= Math.max(a.y, b.y)
  }
  return o1 * o2 < 0 && o3 * o4 < 0
}

export function measureLayoutQuality(input: QualityInput): LayoutQuality {
  const positionById = new Map(input.positions.map((position) => [position.id, position]))
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]))
  const centers = new Map<string, LayoutPoint>()
  for (const node of input.nodes) {
    const position = positionById.get(node.id)
    if (position) centers.set(node.id, centerOf(node, position))
  }

  let edgeCrossings = 0
  let backwardEdges = 0
  let totalEdgeLength = 0
  const usableEdges = input.edges.filter((edge) => centers.has(edge.from) && centers.has(edge.to))
  for (let index = 0; index < usableEdges.length; index += 1) {
    const a = centers.get(usableEdges[index]!.from)!
    const b = centers.get(usableEdges[index]!.to)!
    totalEdgeLength += Math.hypot(b.x - a.x, b.y - a.y)
    if (b.x < a.x || (b.x === a.x && b.y < a.y)) backwardEdges += 1
    for (let other = index + 1; other < usableEdges.length; other += 1) {
      const c = centers.get(usableEdges[other]!.from)!
      const d = centers.get(usableEdges[other]!.to)!
      if (segmentsCross(a, b, c, d)) edgeCrossings += 1
    }
  }

  let overlappingNodes = 0
  const positionedNodes = input.nodes.filter((node) => positionById.has(node.id))
  for (let index = 0; index < positionedNodes.length; index += 1) {
    const left = positionedNodes[index]!
    const leftPosition = positionById.get(left.id)!
    for (let other = index + 1; other < positionedNodes.length; other += 1) {
      const right = positionedNodes[other]!
      const rightPosition = positionById.get(right.id)!
      const overlaps = leftPosition.x < rightPosition.x + right.width
        && leftPosition.x + left.width > rightPosition.x
        && leftPosition.y < rightPosition.y + right.height
        && leftPosition.y + left.height > rightPosition.y
      if (overlaps) overlappingNodes += 1
    }
  }

  let pinnedNodeDrift = 0
  for (const node of input.nodes) {
    if (!node.pinned) continue
    const position = positionById.get(node.id)
    if (!position) continue
    pinnedNodeDrift += Math.hypot(position.x - node.x, position.y - node.y)
  }

  return { edgeCrossings, backwardEdges, totalEdgeLength, overlappingNodes, pinnedNodeDrift }
}
