import type { CanvasNode } from '../../model'

const FAMILY_ORDER: Record<CanvasNode['kind'], number> = {
  source: 0,
  context: 0,
  working: 1,
  generated: 2,
  process: 3,
  decision: 3,
  note: 3,
}

export interface LayoutPreviewItem { id: string; x: number; y: number }

interface LayoutOptions {
  respectLocked?: boolean
}

function gapBetween(a: CanvasNode, b: CanvasNode): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  return Math.hypot(dx, dy)
}

function primaryComponent(nodes: CanvasNode[], neighborhoodGap: number): Set<string> {
  const visited = new Set<number>()
  let best: number[] = []
  for (let seed = 0; seed < nodes.length; seed += 1) {
    if (visited.has(seed)) continue
    const component: number[] = []
    const queue = [seed]
    visited.add(seed)
    while (queue.length) {
      const current = queue.shift()
      if (current === undefined) break
      component.push(current)
      for (let candidate = 0; candidate < nodes.length; candidate += 1) {
        if (visited.has(candidate) || gapBetween(nodes[current], nodes[candidate]) > neighborhoodGap) continue
        visited.add(candidate)
        queue.push(candidate)
      }
    }
    if (component.length > best.length) best = component
  }
  return new Set(best.map((index) => nodes[index].id))
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, gap = 26): boolean {
  return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y)
}

function nextFreePosition(
  node: CanvasNode,
  candidate: { x: number; y: number },
  occupied: Array<{ x: number; y: number; width: number; height: number }>,
  horizontal: boolean,
): { x: number; y: number } {
  let current = { ...candidate }
  let guard = 0
  while (occupied.some((item) => overlaps({ ...current, width: node.width, height: node.height }, item)) && guard < 80) {
    current = horizontal ? { x: current.x + Math.max(250, node.width + 34), y: current.y } : { x: current.x, y: current.y + Math.max(154, node.height + 34) }
    guard += 1
  }
  return current
}

export function proposeScopeLayout(nodes: CanvasNode[], scopeId: string, options: LayoutOptions = { respectLocked: true }): LayoutPreviewItem[] {
  const scopeNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
  const locked = options.respectLocked === false ? [] : scopeNodes.filter((node) => node.positionLocked)
  const movable = options.respectLocked === false ? scopeNodes : scopeNodes.filter((node) => !node.positionLocked)
  const groups = new Map<number, CanvasNode[]>()
  movable.forEach((node) => {
    const key = FAMILY_ORDER[node.kind]
    groups.set(key, [...(groups.get(key) ?? []), node])
  })

  const columns: Record<number, number> = { 0: 72, 1: 430, 2: 830, 3: 430 }
  const rows: Record<number, number> = { 0: 110, 1: 210, 2: 170, 3: 570 }
  const occupied = locked.map((node) => ({ x: node.x, y: node.y, width: node.width, height: node.height }))
  const result: LayoutPreviewItem[] = []

  for (const [family, familyNodes] of groups) {
    familyNodes
      .toSorted((a, b) => a.y - b.y || a.x - b.x || a.title.localeCompare(b.title))
      .forEach((node, index) => {
        const horizontal = family === 3
        const candidate = {
          x: columns[family] + (horizontal ? index * 270 : 0),
          y: rows[family] + (horizontal ? 0 : index * Math.max(154, node.height + 34)),
        }
        const next = nextFreePosition(node, candidate, occupied, horizontal)
        occupied.push({ ...next, width: node.width, height: node.height })
        result.push({ id: node.id, ...next })
      })
  }

  return result
}

/**
 * 只把脱离主内容岛的对象归拢到主岛旁边。主岛与固定对象保持原位，调用方
 * 必须先展示 preview，再由用户确认写入坐标。
 */
export function proposeIslandRecoveryLayout(
  nodes: CanvasNode[],
  scopeId: string,
  options: LayoutOptions = { respectLocked: true },
  neighborhoodGap = 720,
): LayoutPreviewItem[] {
  const scopeNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
  if (scopeNodes.length < 2) return []
  const primaryIds = primaryComponent(scopeNodes, neighborhoodGap)
  const primary = scopeNodes.filter((node) => primaryIds.has(node.id))
  const outliers = scopeNodes.filter((node) => !primaryIds.has(node.id) && (options.respectLocked === false || !node.positionLocked))
  if (!outliers.length) return []

  const right = Math.max(...primary.map((node) => node.x + node.width))
  const top = Math.min(...primary.map((node) => node.y))
  const occupied = scopeNodes
    .filter((node) => primaryIds.has(node.id) || node.positionLocked)
    .map((node) => ({ x: node.x, y: node.y, width: node.width, height: node.height }))
  const result: LayoutPreviewItem[] = []
  let cursorY = top

  for (const node of outliers.toSorted((a, b) => a.y - b.y || a.x - b.x || a.title.localeCompare(b.title))) {
    const next = nextFreePosition(node, { x: right + 72, y: cursorY }, occupied, false)
    occupied.push({ ...next, width: node.width, height: node.height })
    result.push({ id: node.id, ...next })
    cursorY = next.y + node.height + 34
  }
  return result
}

export function applyScopeLayout(nodes: CanvasNode[], preview: LayoutPreviewItem[]): CanvasNode[] {
  const byId = new Map(preview.map((item) => [item.id, item]))
  return nodes.map((node) => {
    const position = byId.get(node.id)
    return position ? { ...node, x: position.x, y: position.y } : node
  })
}
