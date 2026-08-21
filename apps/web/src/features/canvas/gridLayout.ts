import type { CanvasNode } from '../../model'

export interface GridLayoutOptions {
  readonly columns?: number
  readonly gapX?: number
  readonly gapY?: number
  readonly originX?: number
  readonly originY?: number
  readonly cellWidth?: number
  readonly cellHeight?: number
  /** Soft-grid step. Defaults are deliberately small so coarse spatial meaning survives. */
  readonly snapX?: number
  readonly snapY?: number
  readonly searchRings?: number
}

interface GridSlot {
  readonly x: number
  readonly y: number
}

function uniqueOrder(nodes: readonly CanvasNode[], order: readonly string[]) {
  const ids = new Set(nodes.map((node) => node.id))
  return [
    ...order.filter((id, index) => ids.has(id) && order.indexOf(id) === index),
    ...nodes.map((node) => node.id).filter((id) => !order.includes(id)),
  ]
}

function snap(value: number, step: number) {
  return Math.round(value / Math.max(1, step)) * Math.max(1, step)
}

function overlaps(a: CanvasNode | { x:number; y:number; width:number; height:number }, b: CanvasNode | { x:number; y:number; width:number; height:number }, gapX: number, gapY: number) {
  return a.x < b.x + b.width + gapX
    && a.x + a.width + gapX > b.x
    && a.y < b.y + b.height + gapY
    && a.y + a.height + gapY > b.y
}

function candidateOffsets(ring: number): readonly [number, number][] {
  if (ring === 0) return [[0, 0]]
  const offsets: [number, number][] = []
  for (let dx = -ring; dx <= ring; dx += 1) {
    offsets.push([dx, -ring], [dx, ring])
  }
  for (let dy = -ring + 1; dy <= ring - 1; dy += 1) {
    offsets.push([-ring, dy], [ring, dy])
  }
  return offsets
}

/**
 * Build stable slots near the nodes' existing positions.
 *
 * Grid in LCOS is a Tidy projection, not a dense matrix packing mode. The
 * generated slots therefore preserve the coarse spatial ordering and only
 * correct alignment/collision. `order` then maps identities onto those stable
 * slots, which preserves the existing Android-home-style drag displacement.
 */
function buildSoftSlots(nodes: readonly CanvasNode[], options: GridLayoutOptions): GridSlot[] {
  if (!nodes.length) return []
  const snapX = options.snapX ?? 24
  const snapY = options.snapY ?? 20
  const gapX = options.gapX ?? 28
  const gapY = options.gapY ?? 24
  const searchRings = Math.max(2, options.searchRings ?? 14)
  const spatialOrder = [...nodes].sort((a, b) => {
    const rowTolerance = Math.max(48, Math.min(a.height, b.height) * 0.55)
    if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y
    return a.x - b.x
  })
  const placed: Array<{ x:number; y:number; width:number; height:number }> = []
  const slots: GridSlot[] = []
  for (const node of spatialOrder) {
    const baseX = snap(node.x, snapX)
    const baseY = snap(node.y, snapY)
    let best: { x:number; y:number; cost:number } | null = null
    for (let ring = 0; ring <= searchRings; ring += 1) {
      for (const [dx, dy] of candidateOffsets(ring)) {
        const x = baseX + dx * snapX
        const y = baseY + dy * snapY
        const rect = { x, y, width: node.width, height: node.height }
        if (placed.some((other) => overlaps(rect, other, gapX, gapY))) continue
        const cost = (x - node.x) ** 2 + (y - node.y) ** 2
        if (best === null || cost < best.cost) best = { x, y, cost }
      }
      if (best) break
    }
    const fallback = best ?? {
      x: baseX,
      y: (placed.length ? Math.max(...placed.map((item) => item.y + item.height + gapY)) : baseY),
      cost: 0,
    }
    placed.push({ x: fallback.x, y: fallback.y, width: node.width, height: node.height })
    slots.push({ x: fallback.x, y: fallback.y })
  }
  return slots
}

/**
 * Deterministic Presentation-only Soft Grid projection.
 * It never mutates Freeform coordinates; callers render returned clones.
 */
export function projectNodesToGrid(nodes: readonly CanvasNode[], order: readonly string[], options: GridLayoutOptions = {}): CanvasNode[] {
  if (!nodes.length) return []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const canonicalOrder = uniqueOrder(nodes, order)
  const slots = buildSoftSlots(nodes, options)
  return canonicalOrder.flatMap((id, index) => {
    const node = byId.get(id)
    const slot = slots[index]
    if (!node || !slot) return []
    return [{ ...node, x: slot.x, y: slot.y }]
  })
}

/** Android-home-style displacement order: moving A onto C shifts intermediate slots. */
export function reorderGridOrder(order: readonly string[], sourceId: string, targetId: string): string[] {
  const result = [...order]
  const source = result.indexOf(sourceId)
  const target = result.indexOf(targetId)
  if (source < 0 || target < 0 || source === target) return result
  const [moved] = result.splice(source, 1)
  const targetAfterRemoval = result.indexOf(targetId)
  result.splice(targetAfterRemoval < 0 ? result.length : targetAfterRemoval + (source < target ? 1 : 0), 0, moved!)
  return result
}

/** Nearest projected slot under a world-space point. */
export function nearestGridTarget(nodes: readonly CanvasNode[], x: number, y: number, excludeId?: string): string | null {
  let best: { id: string; distance: number } | null = null
  for (const node of nodes) {
    if (node.id === excludeId) continue
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    const distance = (cx - x) ** 2 + (cy - y) ** 2
    if (best === null || distance < best.distance) best = { id: node.id, distance }
  }
  return best?.id ?? null
}
