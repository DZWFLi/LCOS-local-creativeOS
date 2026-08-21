import type { CanvasEdge, CanvasNode } from '../../model'

export interface LocalRelationNode {
  node: CanvasNode
  ring: 0 | 1 | 2
}

export function buildLocalRelationNodes(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], requestedFocusIds: readonly string[], hops: 1 | 2): LocalRelationNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const focusIds = requestedFocusIds.filter((id, index, source) => byId.has(id) && source.indexOf(id) === index)
  if (!focusIds.length && nodes[0]) focusIds.push(nodes[0].id)
  if (!focusIds.length) return []
  const graph = new Map<string, Set<string>>()
  nodes.forEach((node) => graph.set(node.id, new Set()))
  edges.forEach((edge) => {
    if (!byId.has(edge.from) || !byId.has(edge.to)) return
    graph.get(edge.from)?.add(edge.to)
    graph.get(edge.to)?.add(edge.from)
  })
  const distance = new Map<string, number>()
  const queue = focusIds.map((id) => ({ id, depth: 0 }))
  focusIds.forEach((id) => distance.set(id, 0))
  while (queue.length) {
    const current = queue.shift()!
    if (current.depth >= hops) continue
    graph.get(current.id)?.forEach((next) => {
      const nextDepth = current.depth + 1
      if (nextDepth > hops || (distance.get(next) ?? Infinity) <= nextDepth) return
      distance.set(next, nextDepth)
      queue.push({ id: next, depth: nextDepth })
    })
  }
  return nodes.flatMap((node) => {
    const value = distance.get(node.id)
    return value === undefined ? [] : [{ node, ring: Math.min(2, value) as 0 | 1 | 2 }]
  })
}

export function relationCurvePath(start: { x: number; y: number }, end: { x: number; y: number }, parallelIndex = 0, parallelCount = 1) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const normalX = -dy / length
  const normalY = dx / length
  const centered = parallelIndex - (parallelCount - 1) / 2
  const bend = centered * 18 + Math.min(34, length * .08) * (parallelCount === 1 ? .28 : 1)
  const mx = (start.x + end.x) / 2 + normalX * bend
  const my = (start.y + end.y) / 2 + normalY * bend
  return `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`
}
