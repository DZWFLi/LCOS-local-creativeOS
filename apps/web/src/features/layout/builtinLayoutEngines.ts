import { layoutConnectedComponents } from './layoutGraph'
import { layoutBounds, movedLayoutIds, removeLayoutOverlaps, routeLayoutEdges } from './layoutGeometry'
import type { LayoutComponent } from './layoutGraph'
import type { LayoutNodeInput, LayoutPosition, LayoutRequest, LayoutResult } from './layoutTypes'

const hashUnit = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return ((hash >>> 0) % 1000) / 1000
}

function anchoredTranslation(component: LayoutComponent, proposed: LayoutPosition[]): LayoutPosition[] {
  const pinned = component.nodes.filter((node) => node.pinned)
  if (!pinned.length) return proposed
  const byId = new Map(proposed.map((item) => [item.id, item]))
  let dx = 0, dy = 0, count = 0
  pinned.forEach((node) => {
    const point = byId.get(node.id)
    if (!point) return
    dx += node.x - point.x
    dy += node.y - point.y
    count += 1
  })
  const shiftX = count ? dx / count : 0
  const shiftY = count ? dy / count : 0
  return proposed.map((item) => {
    const node = component.nodes.find((candidate) => candidate.id === item.id)!
    return node.pinned ? { id: item.id, x: node.x, y: node.y } : { id: item.id, x: item.x + shiftX, y: item.y + shiftY }
  })
}

function layeredComponent(component: LayoutComponent, gap: number): LayoutPosition[] {
  const ids = new Set(component.nodes.map((node) => node.id))
  const relevant = component.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))
  const rank = new Map(component.nodes.map((node) => [node.id, 0]))
  // Bounded relaxation survives cycles without pretending the graph is a DAG.
  for (let pass = 0; pass < component.nodes.length; pass += 1) {
    let changed = false
    relevant.forEach((edge) => {
      const next = Math.min(component.nodes.length - 1, (rank.get(edge.from) ?? 0) + 1)
      if (next > (rank.get(edge.to) ?? 0)) { rank.set(edge.to, next); changed = true }
    })
    if (!changed) break
  }
  const usedRanks = [...new Set(rank.values())].sort((a, b) => a - b)
  const normalized = new Map(usedRanks.map((value, index) => [value, index]))
  const groups = new Map<number, LayoutNodeInput[]>()
  component.nodes.forEach((node) => {
    const column = normalized.get(rank.get(node.id) ?? 0) ?? 0
    groups.set(column, [...(groups.get(column) ?? []), node])
  })
  const columnWidths = [...groups.entries()].map(([column, nodes]) => [column, Math.max(...nodes.map((node) => node.width))] as const)
  const xByColumn = new Map<number, number>()
  let cursorX = 0
  columnWidths.forEach(([column, width]) => { xByColumn.set(column, cursorX); cursorX += width + Math.max(96, gap * 2.8) })
  const result: LayoutPosition[] = []
  ;[...groups.entries()].sort(([a], [b]) => a - b).forEach(([column, nodes]) => {
    const ordered = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    let cursorY = 0
    ordered.forEach((node) => {
      result.push({ id: node.id, x: xByColumn.get(column) ?? 0, y: cursorY })
      cursorY += node.height + Math.max(54, gap * 1.7)
    })
  })
  return anchoredTranslation(component, result)
}

function relationalComponent(component: LayoutComponent, gap: number): LayoutPosition[] {
  const byId = new Map(component.nodes.map((node) => [node.id, node]))
  const positions = new Map(component.nodes.map((node) => [node.id, { x: node.x + (hashUnit(node.id) - .5) * 4, y: node.y + (hashUnit(`${node.id}:y`) - .5) * 4 }]))
  const ideal = Math.max(150, gap * 4.4)
  const iterations = component.nodes.length > 180 ? 28 : component.nodes.length > 80 ? 44 : 68
  const step = component.nodes.length > 120 ? .12 : .18
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = new Map(component.nodes.map((node) => [node.id, { x: 0, y: 0 }]))
    const cellSize = ideal * 1.35
    const grid = new Map<string, LayoutNodeInput[]>()
    component.nodes.forEach((node) => {
      const point = positions.get(node.id)!
      const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`
      grid.set(key, [...(grid.get(key) ?? []), node])
    })
    component.nodes.forEach((node) => {
      if (node.pinned) return
      const point = positions.get(node.id)!
      const cx = Math.floor(point.x / cellSize), cy = Math.floor(point.y / cellSize)
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
        grid.get(`${gx}:${gy}`)?.forEach((other) => {
          if (other.id === node.id) return
          const target = positions.get(other.id)!
          let dx = point.x - target.x, dy = point.y - target.y
          const distance2 = Math.max(64, dx * dx + dy * dy)
          const distance = Math.sqrt(distance2)
          if (distance > ideal * 2.4) return
          const magnitude = (ideal * ideal) / distance2
          dx /= distance; dy /= distance
          const force = forces.get(node.id)!
          force.x += dx * magnitude; force.y += dy * magnitude
        })
      }
    })
    component.edges.forEach((edge) => {
      const fromNode = byId.get(edge.from), toNode = byId.get(edge.to)
      const from = positions.get(edge.from), to = positions.get(edge.to)
      if (!fromNode || !toNode || !from || !to) return
      let dx = to.x - from.x, dy = to.y - from.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const magnitude = (distance - ideal) / ideal
      dx /= distance; dy /= distance
      if (!fromNode.pinned) { const force = forces.get(fromNode.id)!; force.x += dx * magnitude; force.y += dy * magnitude }
      if (!toNode.pinned) { const force = forces.get(toNode.id)!; force.x -= dx * magnitude; force.y -= dy * magnitude }
    })
    component.nodes.forEach((node) => {
      if (node.pinned) { positions.set(node.id, { x: node.x, y: node.y }); return }
      const point = positions.get(node.id)!, force = forces.get(node.id)!
      // Weak gravity preserves spatial memory and prevents component drift.
      force.x += (node.x - point.x) * .0025
      force.y += (node.y - point.y) * .0025
      const cooling = 1 - iteration / iterations * .72
      positions.set(node.id, { x: point.x + Math.max(-34, Math.min(34, force.x * ideal * step * cooling)), y: point.y + Math.max(-34, Math.min(34, force.y * ideal * step * cooling)) })
    })
  }
  return component.nodes.map((node) => ({ id: node.id, ...(positions.get(node.id) ?? { x: node.x, y: node.y }) }))
}

function packComponents(components: readonly LayoutComponent[], layouts: readonly LayoutPosition[][], gap: number, origin?: { x: number; y: number }): LayoutPosition[] {
  if (!components.length) return []
  const entries = components.map((component, index) => ({ component, layout: layouts[index]!, bounds: layoutBounds(component.nodes, layouts[index]!)! }))
  const anchored = entries.filter(({ component }) => component.nodes.some((node) => node.pinned))
  const movable = entries.filter(({ component }) => !component.nodes.some((node) => node.pinned))
  const result: LayoutPosition[] = anchored.flatMap(({ layout }) => layout)
  const occupied = anchored.map(({ bounds }) => bounds)
  const allBounds = layoutBounds(components.flatMap((component) => component.nodes))
  const start = origin ?? { x: allBounds?.x ?? 0, y: allBounds?.y ?? 0 }
  let x = start.x, y = start.y, rowHeight = 0
  const targetWidth = Math.max(900, Math.sqrt(movable.reduce((sum, item) => sum + item.bounds.width * item.bounds.height, 0)) * 1.6)
  movable.forEach(({ layout, bounds }) => {
    if (x > start.x && x + bounds.width > start.x + targetWidth) { x = start.x; y += rowHeight + gap; rowHeight = 0 }
    let shiftX = x - bounds.x, shiftY = y - bounds.y, guard = 0
    const translated = () => ({ x: bounds.x + shiftX, y: bounds.y + shiftY, width: bounds.width, height: bounds.height })
    while (occupied.some((item) => !(translated().x + translated().width + gap <= item.x || item.x + item.width + gap <= translated().x || translated().y + translated().height + gap <= item.y || item.y + item.height + gap <= translated().y)) && guard < 80) {
      shiftX += gap + 80
      if (shiftX > targetWidth) { shiftX = start.x - bounds.x; shiftY += rowHeight + gap + 80 }
      guard += 1
    }
    result.push(...layout.map((item) => ({ id: item.id, x: item.x + shiftX, y: item.y + shiftY })))
    occupied.push(translated())
    x = translated().x + translated().width + gap
    y = translated().y
    rowHeight = Math.max(rowHeight, translated().height)
  })
  return result
}

export function builtinLayout(request: LayoutRequest): LayoutResult {
  if (!request.nodes.length) return { engine: request.strategy === 'relational' ? 'builtin-relational' : request.strategy === 'layered' ? 'builtin-layered' : 'manual', strategy: request.strategy, positions: [], routes: [], componentCount: 0, movedIds: [] }
  if (request.strategy === 'manual') {
    const positions = removeLayoutOverlaps(request.nodes, request.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y })), request.gap ?? 28)
    return { engine: 'manual', strategy: 'manual', positions, routes: routeLayoutEdges(request.nodes, positions, request.edges), componentCount: layoutConnectedComponents(request.nodes, request.edges).length, movedIds: movedLayoutIds(request.nodes, positions) }
  }
  const gap = request.gap ?? 30
  const components = layoutConnectedComponents(request.nodes, request.edges)
  const layouts = components.map((component) => request.strategy === 'layered' ? layeredComponent(component, gap) : relationalComponent(component, gap))
  let positions = packComponents(components, layouts, request.componentGap ?? 110, request.origin)
  positions = removeLayoutOverlaps(request.nodes, positions, gap)
  return {
    engine: request.strategy === 'layered' ? 'builtin-layered' : 'builtin-relational',
    strategy: request.strategy,
    positions,
    routes: routeLayoutEdges(request.nodes, positions, request.edges, request.strategy === 'layered'),
    componentCount: components.length,
    movedIds: movedLayoutIds(request.nodes, positions),
  }
}
