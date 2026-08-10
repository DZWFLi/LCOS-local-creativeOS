import type { LayoutEdgeInput, LayoutNodeInput } from './layoutTypes'

export interface LayoutComponent {
  nodes: LayoutNodeInput[]
  edges: LayoutEdgeInput[]
}

/** Undirected connected components: layout membership is relation-derived, not node-kind-derived. */
export function layoutConnectedComponents(nodes: readonly LayoutNodeInput[], edges: readonly LayoutEdgeInput[]): LayoutComponent[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]))
  edges.forEach((edge) => {
    if (!byId.has(edge.from) || !byId.has(edge.to)) return
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  })
  const visited = new Set<string>()
  const components: LayoutComponent[] = []
  nodes.forEach((seed) => {
    if (visited.has(seed.id)) return
    const queue = [seed.id]
    const ids = new Set<string>()
    visited.add(seed.id)
    while (queue.length) {
      const id = queue.shift()!
      ids.add(id)
      adjacency.get(id)?.forEach((next) => {
        if (visited.has(next)) return
        visited.add(next)
        queue.push(next)
      })
    }
    components.push({
      nodes: nodes.filter((node) => ids.has(node.id)),
      edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    })
  })
  return components.sort((left, right) => right.nodes.length - left.nodes.length || left.nodes[0]!.id.localeCompare(right.nodes[0]!.id))
}
