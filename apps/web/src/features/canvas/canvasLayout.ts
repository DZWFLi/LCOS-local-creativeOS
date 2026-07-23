import type { CanvasNode } from '../../model'

interface Point { x: number; y: number }
interface Size { width: number; height: number }

const DEFAULT_GAP = 24
const COLUMN_GAP = 54
const ZONE_OFFSET = 96

export function findPendingReturnPosition(nodes: CanvasNode[], target: CanvasNode, size: Size, gap = DEFAULT_GAP): Point {
  const startX = target.x + target.width + ZONE_OFFSET
  const startY = Math.max(72, target.y - 10)
  const rowStep = size.height + gap
  const columnStep = size.width + COLUMN_GAP

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const candidate = { x: startX + column * columnStep, y: startY + row * rowStep }
      if (!nodes.some((node) => rectanglesOverlap(candidate, size, node, gap))) return candidate
    }
  }

  const rightmost = nodes.reduce((max, node) => Math.max(max, node.x + node.width), startX)
  return { x: rightmost + COLUMN_GAP, y: startY }
}

export function getPendingZoneBounds(nodes: CanvasNode[]): { x: number; y: number; width: number; height: number } | null {
  const pending = nodes.filter((node) => node.kind === 'generated' && node.draft)
  if (!pending.length) return null
  const left = Math.min(...pending.map((node) => node.x))
  const top = Math.min(...pending.map((node) => node.y))
  const right = Math.max(...pending.map((node) => node.x + node.width))
  const bottom = Math.max(...pending.map((node) => node.y + node.height))
  return { x: left - 28, y: top - 46, width: right - left + 56, height: bottom - top + 74 }
}

function rectanglesOverlap(candidate: Point, size: Size, node: CanvasNode, gap: number): boolean {
  return candidate.x < node.x + node.width + gap
    && candidate.x + size.width + gap > node.x
    && candidate.y < node.y + node.height + gap
    && candidate.y + size.height + gap > node.y
}
