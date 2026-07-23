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

export function applyScopeLayout(nodes: CanvasNode[], preview: LayoutPreviewItem[]): CanvasNode[] {
  const byId = new Map(preview.map((item) => [item.id, item]))
  return nodes.map((node) => {
    const position = byId.get(node.id)
    return position ? { ...node, x: position.x, y: position.y } : node
  })
}
