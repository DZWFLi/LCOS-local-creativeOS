import type { CanvasEdge, CanvasNode } from '../../model'

export interface SurfaceLayoutItem { readonly node: CanvasNode; readonly left: number; readonly top: number; readonly width: number }
export interface SurfaceLayoutEdge { readonly edge: CanvasEdge; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
export interface SurfaceLayout { readonly items: readonly SurfaceLayoutItem[]; readonly edges: readonly SurfaceLayoutEdge[] }

const connect = (items: readonly SurfaceLayoutItem[], edges: readonly CanvasEdge[]): readonly SurfaceLayoutEdge[] => {
  const byId = new Map(items.map((item) => [item.node.id, item]))
  return edges.flatMap((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    return from && to ? [{ edge, x1: from.left + from.width, y1: from.top + 5, x2: to.left, y2: to.top + 5 }] : []
  })
}

/** Readable collaboration trail: chronology without inventing business roles. */
export function layoutContextTrail(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): SurfaceLayout {
  const ordered = [...nodes].sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) || left.title.localeCompare(right.title))
  const columns = Math.min(4, Math.max(1, ordered.length))
  const items = ordered.map((node, index) => ({
    node,
    left: columns === 1 ? 50 : 12 + (index % columns) * (76 / (columns - 1)),
    top: 16 + Math.floor(index / columns) * 24,
    width: Math.min(19, 72 / columns),
  }))
  return { items, edges: connect(items, edges) }
}

/** Left-to-right execution graph derived only from existing relations. */
export function layoutWorkflowGraph(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): SurfaceLayout {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const relevant = edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  const rank = new Map(nodes.map((node) => [node.id, 0]))
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false
    relevant.forEach((edge) => {
      const next = Math.min(nodes.length - 1, (rank.get(edge.from) ?? 0) + 1)
      if (next > (rank.get(edge.to) ?? 0)) { rank.set(edge.to, next); changed = true }
    })
    if (!changed) break
  }
  const ranks = [...new Set(rank.values())].sort((a, b) => a - b)
  const normalizedRank = new Map(ranks.map((value, index) => [value, index]))
  const groups = new Map<number, CanvasNode[]>()
  nodes.forEach((node) => {
    const value = normalizedRank.get(rank.get(node.id) ?? 0) ?? 0
    groups.set(value, [...(groups.get(value) ?? []), node])
  })
  const maxRank = Math.max(1, groups.size - 1)
  const items = [...groups.entries()].flatMap(([column, group]) => group.map((node, index) => ({
    node,
    left: groups.size === 1 ? 50 : 12 + (column / maxRank) * 76,
    top: 18 + ((index + 1) / (group.length + 1)) * 62,
    width: node.kind === 'process' ? 20 : 17,
  })))
  return { items, edges: connect(items, relevant) }
}

export interface SpatialSurfaceLayoutItem { readonly node: CanvasNode; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface SpatialSurfaceLayoutEdge { readonly edge: CanvasEdge; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
export interface SpatialSurfaceLayout { readonly items: readonly SpatialSurfaceLayoutItem[]; readonly edges: readonly SpatialSurfaceLayoutEdge[] }

/** Phase B adapter: preserve existing percentage heuristics while rendering through the shared spatial engine. */
export function surfaceLayoutToSpatial(layout: SurfaceLayout, worldWidth = 1200, worldHeight = 760): SpatialSurfaceLayout {
  const items = layout.items.map((item) => {
    const width = Math.max(146, Math.min(224, worldWidth * item.width / 100))
    const height = item.node.kind === 'process' ? 58 : 50
    return {
      node: item.node,
      x: worldWidth * item.left / 100 - width / 2,
      y: worldHeight * item.top / 100 - height / 2,
      width,
      height,
    }
  })
  const byId = new Map(items.map((item) => [item.node.id, item]))
  const edges = layout.edges.flatMap(({ edge }) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (!from || !to) return []
    return [{ edge, x1: from.x + from.width, y1: from.y + from.height / 2, x2: to.x, y2: to.y + to.height / 2 }]
  })
  return { items, edges }
}


/**
 * Manual-first Presentation seed. It preserves the user's existing relative spatial memory
 * and only removes the arbitrary world offset so the view opens in a readable area.
 */
export function layoutManualSpatial(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], origin = { x: 120, y: 120 }): SpatialSurfaceLayout {
  if (!nodes.length) return { items: [], edges: [] }
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const items = nodes.map((node) => ({
    node,
    x: origin.x + (node.x - minX),
    y: origin.y + (node.y - minY),
    width: node.kind === 'process' ? 206 : Math.max(154, Math.min(204, node.width || 184)),
    height: node.kind === 'process' ? 60 : 50,
  }))
  const byId = new Map(items.map((item) => [item.node.id, item]))
  const spatialEdges = edges.flatMap((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    return from && to ? [{ edge, x1: from.x + from.width, y1: from.y + from.height / 2, x2: to.x, y2: to.y + to.height / 2 }] : []
  })
  return { items, edges: spatialEdges }
}
