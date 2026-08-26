import type { CanvasNode } from '../../model'
import { removeLayoutOverlaps } from '../layout/layoutGeometry'
import type { LayoutNodeInput, LayoutPosition } from '../layout/layoutTypes'

export const MAIN_CANVAS_GRID_STEP = 24

interface VisualInsets { left: number; right: number; top: number; bottom: number }

/**
 * Presentation geometry, not Project Truth.
 *
 * Several LCOS object species deliberately draw outside the persisted node box
 * (folder tabs / peeking sheets / usage captions). Layout and snap code must
 * reserve that visible body instead of pretending every object is the same
 * rectangular card anchored at x/y.
 */
export function nodeVisualInsets(node: CanvasNode): VisualInsets {
  if (node.entityKind === 'collection') return { left: 10, right: 12, top: 18, bottom: 24 }
  if (node.entityKind === 'context' || node.entityKind === 'workflow' || node.entityKind === 'workspace') return { left: 8, right: 8, top: 10, bottom: 18 }
  if (node.kind === 'note') return { left: 6, right: 6, top: 6, bottom: 18 }
  return { left: 7, right: 7, top: 7, bottom: 18 }
}

export function nodeVisualBounds(node: CanvasNode, position: Pick<CanvasNode, 'x' | 'y'> = node) {
  const inset = nodeVisualInsets(node)
  return {
    x: position.x - inset.left,
    y: position.y - inset.top,
    width: node.width + inset.left + inset.right,
    height: node.height + inset.top + inset.bottom,
  }
}

export function getVisualSelectionBounds(nodes: readonly CanvasNode[], selectedIds: readonly string[]) {
  const idSet = new Set(selectedIds)
  const rects = nodes.filter((node) => idSet.has(node.id)).map((node) => nodeVisualBounds(node))
  if (!rects.length) return null
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}

function visualInputs(nodes: readonly CanvasNode[]): LayoutNodeInput[] {
  return nodes.map((node) => {
    const bounds = nodeVisualBounds(node)
    return { id: node.id, ...bounds, pinned: Boolean(node.positionLocked) }
  })
}

function modelPositionFromVisual(node: CanvasNode, point: { x: number; y: number }): LayoutPosition {
  const inset = nodeVisualInsets(node)
  return { id: node.id, x: point.x + inset.left, y: point.y + inset.top }
}

function visualPositionFromModel(node: CanvasNode, point: { x: number; y: number }): LayoutPosition {
  const inset = nodeVisualInsets(node)
  return { id: node.id, x: point.x - inset.left, y: point.y - inset.top }
}

/** Collision-repair arbitrary layout output against each node's visible body. */
export function repairVisualLayoutPositions(
  nodes: readonly CanvasNode[],
  positions: readonly LayoutPosition[],
  gap = 24,
): LayoutPosition[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visualPositions = positions.flatMap((position) => {
    const node = byId.get(position.id)
    return node ? [visualPositionFromModel(node, position)] : []
  })
  const repaired = removeLayoutOverlaps(visualInputs(nodes), visualPositions, gap)
  return repaired.flatMap((point) => {
    const node = byId.get(point.id)
    return node ? [modelPositionFromVisual(node, point)] : []
  })
}

/**
 * Reliable default for heterogeneous material walls.
 * It packs visible rectangles row-by-row, so portrait images, wide cards and
 * system objects never share a fake common origin/size.
 */
export function layoutVisualGrid(
  nodes: readonly CanvasNode[],
  origin: { x: number; y: number },
  gapX = 30,
  gapY = 26,
): LayoutPosition[] {
  if (!nodes.length) return []
  const ordered = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const bodies = ordered.map((node) => ({ node, bounds: nodeVisualBounds(node) }))
  const totalArea = bodies.reduce((sum, item) => sum + item.bounds.width * item.bounds.height, 0)
  const widest = Math.max(...bodies.map((item) => item.bounds.width), 180)
  const targetWidth = Math.max(widest * 2 + gapX, Math.min(1500, Math.sqrt(totalArea) * 1.65))
  const visualPositions: LayoutPosition[] = []
  let cursorX = origin.x
  let cursorY = origin.y
  let rowHeight = 0
  for (const { node, bounds } of bodies) {
    if (node.positionLocked) {
      visualPositions.push({ id: node.id, x: bounds.x, y: bounds.y })
      continue
    }
    if (cursorX > origin.x && cursorX + bounds.width > origin.x + targetWidth) {
      cursorX = origin.x
      cursorY += rowHeight + gapY
      rowHeight = 0
    }
    visualPositions.push({ id: node.id, x: cursorX, y: cursorY })
    cursorX += bounds.width + gapX
    rowHeight = Math.max(rowHeight, bounds.height)
  }
  const repaired = removeLayoutOverlaps(visualInputs(nodes), visualPositions, Math.min(gapX, gapY))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return repaired.flatMap((point) => {
    const node = byId.get(point.id)
    return node ? [modelPositionFromVisual(node, point)] : []
  })
}

function snapNear(value: number, step: number, threshold: number) {
  const target = Math.round(value / step) * step
  return Math.abs(target - value) <= threshold ? target : value
}

/** Snap the visible top-left, not the model origin. */
export function snapNodePositionToGrid(node: CanvasNode, x: number, y: number, zoom: number, step = MAIN_CANVAS_GRID_STEP) {
  const bounds = nodeVisualBounds(node, { x, y })
  const threshold = Math.max(4, Math.min(10, 7 / Math.max(.2, zoom)))
  const snappedX = snapNear(bounds.x, step, threshold)
  const snappedY = snapNear(bounds.y, step, threshold)
  return { x: x + snappedX - bounds.x, y: y + snappedY - bounds.y }
}
