import type { CanvasNode } from '../../model'
import { getSelectionBounds } from './canvasGeometry'

const ROW_GAP = 28
const COLUMN_GAP = 52
const SECTION_GAP = 64

function totalHeight(nodes: CanvasNode[]): number {
  if (!nodes.length) return 0
  return nodes.reduce((sum, node) => sum + node.height, 0) + ROW_GAP * Math.max(0, nodes.length - 1)
}

function maxWidth(nodes: CanvasNode[]): number {
  return Math.max(0, ...nodes.map((node) => node.width))
}

function sortByPosition(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)
}

export function arrangeSelectedNodes(nodes: CanvasNode[], selectedIds: string[]): CanvasNode[] {
  if (selectedIds.length < 2) return nodes
  const selectedSet = new Set(selectedIds)
  const selected = nodes.filter((node) => selectedSet.has(node.id))
  const bounds = getSelectionBounds(nodes, selectedIds)
  if (!bounds) return nodes

  const left = sortByPosition(selected.filter((node) => node.kind === 'source' || node.kind === 'context'))
  const center = sortByPosition(selected.filter((node) => node.kind === 'working'))
  const right = sortByPosition(selected.filter((node) => node.kind === 'generated'))
  const bottom = sortByPosition(selected.filter((node) => node.kind === 'process' || node.kind === 'decision' || node.kind === 'note'))

  const topGroups = [left, center, right].filter((group) => group.length)
  const positions = new Map<string, { x: number; y: number }>()
  let x = bounds.x
  let topHeight = 0

  for (const group of topGroups) {
    let y = bounds.y
    for (const node of group) {
      positions.set(node.id, { x, y })
      y += node.height + ROW_GAP
    }
    topHeight = Math.max(topHeight, totalHeight(group))
    x += maxWidth(group) + COLUMN_GAP
  }

  if (bottom.length) {
    let bottomX = bounds.x
    const bottomY = bounds.y + topHeight + (topGroups.length ? SECTION_GAP : 0)
    for (const node of bottom) {
      positions.set(node.id, { x: bottomX, y: bottomY })
      bottomX += node.width + ROW_GAP
    }
  }

  return nodes.map((node) => {
    const position = positions.get(node.id)
    return position ? { ...node, ...position } : node
  })
}
