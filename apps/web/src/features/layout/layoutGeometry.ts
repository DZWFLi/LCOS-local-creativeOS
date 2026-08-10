import type { LayoutNodeInput, LayoutPoint, LayoutPosition, LayoutRoute } from './layoutTypes'

interface Rect extends LayoutPoint { width: number; height: number; id?: string }

export function layoutBounds(nodes: readonly LayoutNodeInput[], positions: readonly LayoutPosition[] = []): Rect | null {
  if (!nodes.length) return null
  const byId = new Map(positions.map((item) => [item.id, item]))
  const rects = nodes.map((node) => ({ ...node, ...(byId.get(node.id) ?? { x: node.x, y: node.y }) }))
  const x = Math.min(...rects.map((node) => node.x))
  const y = Math.min(...rects.map((node) => node.y))
  const right = Math.max(...rects.map((node) => node.x + node.width))
  const bottom = Math.max(...rects.map((node) => node.y + node.height))
  return { x, y, width: right - x, height: bottom - y }
}

function overlaps(a: Rect, b: Rect, gap: number) {
  return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y)
}

/** Deterministic local collision repair. Pinned/manual anchors are immutable obstacles. */
export function removeLayoutOverlaps(nodes: readonly LayoutNodeInput[], positions: readonly LayoutPosition[], gap = 28): LayoutPosition[] {
  const positionById = new Map(positions.map((item) => [item.id, { ...item }]))
  const ordered = [...nodes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const cellSize = Math.max(120, Math.min(360, Math.max(...nodes.map((node) => Math.max(node.width, node.height)), 120) + gap))
  const grid = new Map<string, Rect[]>()
  const cellRange = (rect: Rect) => ({
    left: Math.floor((rect.x - gap) / cellSize),
    right: Math.floor((rect.x + rect.width + gap) / cellSize),
    top: Math.floor((rect.y - gap) / cellSize),
    bottom: Math.floor((rect.y + rect.height + gap) / cellSize),
  })
  const nearby = (rect: Rect) => {
    const range = cellRange(rect), seen = new Set<Rect>(), result: Rect[] = []
    for (let x = range.left; x <= range.right; x += 1) for (let y = range.top; y <= range.bottom; y += 1) {
      grid.get(`${x}:${y}`)?.forEach((item) => { if (!seen.has(item)) { seen.add(item); result.push(item) } })
    }
    return result
  }
  const occupy = (rect: Rect) => {
    const range = cellRange(rect)
    for (let x = range.left; x <= range.right; x += 1) for (let y = range.top; y <= range.bottom; y += 1) {
      const key = `${x}:${y}`
      grid.set(key, [...(grid.get(key) ?? []), rect])
    }
  }
  ordered.forEach((node) => {
    const source = positionById.get(node.id) ?? { id: node.id, x: node.x, y: node.y }
    if (node.pinned) {
      const rect = { id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }
      occupy(rect)
      positionById.set(node.id, { id: node.id, x: node.x, y: node.y })
      return
    }
    let x = source.x
    let y = source.y
    let guard = 0
    while (nearby({ x, y, width: node.width, height: node.height }).some((item) => overlaps({ x, y, width: node.width, height: node.height }, item, gap)) && guard < 160) {
      const stepX = Math.max(42, Math.min(110, node.width * .42))
      const stepY = Math.max(36, Math.min(90, node.height * .72))
      if (guard % 3 === 2) { x = source.x; y += stepY }
      else x += stepX
      guard += 1
    }
    positionById.set(node.id, { id: node.id, x, y })
    occupy({ id: node.id, x, y, width: node.width, height: node.height })
  })
  return nodes.map((node) => positionById.get(node.id) ?? { id: node.id, x: node.x, y: node.y })
}

export function routeLayoutEdges(nodes: readonly LayoutNodeInput[], positions: readonly LayoutPosition[], edges: readonly { id: string; from: string; to: string }[], orthogonal = false): LayoutRoute[] {
  const byNode = new Map(nodes.map((node) => [node.id, node]))
  const byPosition = new Map(positions.map((item) => [item.id, item]))
  return edges.flatMap((edge) => {
    const fromNode = byNode.get(edge.from), toNode = byNode.get(edge.to)
    if (!fromNode || !toNode) return []
    const from = byPosition.get(edge.from) ?? fromNode
    const to = byPosition.get(edge.to) ?? toNode
    const start = { x: from.x + fromNode.width, y: from.y + fromNode.height / 2 }
    const end = { x: to.x, y: to.y + toNode.height / 2 }
    if (!orthogonal) return [{ id: edge.id, points: [start, end] }]
    const midX = start.x + (end.x - start.x) * .5
    return [{ id: edge.id, points: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end] }]
  })
}

export function movedLayoutIds(nodes: readonly LayoutNodeInput[], positions: readonly LayoutPosition[], epsilon = .5): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return positions.filter((item) => {
    const node = byId.get(item.id)
    return node && (Math.abs(node.x - item.x) > epsilon || Math.abs(node.y - item.y) > epsilon)
  }).map((item) => item.id)
}
