import type { CanvasNode } from '../../model'

export interface CollectionExpandLayoutOptions {
  readonly gapX?: number
  readonly gapY?: number
  readonly columnGap?: number
  readonly maxColumns?: number
}

function intersects(a: Pick<CanvasNode,'x'|'y'|'width'|'height'>, b: Pick<CanvasNode,'x'|'y'|'width'|'height'>, gap = 18) {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y
}

/**
 * Readable local fan-out for physical members when a Collection is expanded.
 * This is Presentation geometry only. It respects each node's real size and
 * walks around unrelated obstacles instead of stacking members on top of them.
 */
export function layoutExpandedCollectionMembers(
  container: CanvasNode,
  members: readonly CanvasNode[],
  obstacles: readonly CanvasNode[],
  options: CollectionExpandLayoutOptions = {},
): ReadonlyMap<string,{x:number;y:number}> {
  const gapX = options.gapX ?? 42
  const gapY = options.gapY ?? 24
  const columnGap = options.columnGap ?? 30
  const maxColumns = Math.max(1, options.maxColumns ?? 3)
  const ordered = [...members].sort((a,b)=>Math.abs(a.y-container.y)-Math.abs(b.y-container.y)||a.y-b.y||a.x-b.x)
  const result = new Map<string,{x:number;y:number}>()
  const placed: CanvasNode[] = []
  let column = 0
  let x = container.x + container.width + gapX
  let y = container.y
  let columnWidth = 0
  let columnStartY = y
  const maxColumnHeight = Math.max(560, container.height * 3.2)

  for (const member of ordered) {
    if (y > columnStartY + maxColumnHeight && column + 1 < maxColumns) {
      column += 1
      x += columnWidth + columnGap
      y = columnStartY
      columnWidth = 0
    }
    let candidate = { ...member, x, y }
    let attempts = 0
    while ((placed.some((other)=>intersects(candidate,other)) || obstacles.some((other)=>intersects(candidate,other))) && attempts < 30) {
      candidate = { ...candidate, y: candidate.y + Math.max(28, gapY) }
      attempts += 1
      if (candidate.y > columnStartY + maxColumnHeight && column + 1 < maxColumns) {
        column += 1
        x += Math.max(columnWidth, member.width) + columnGap
        candidate = { ...candidate, x, y: columnStartY }
        columnWidth = 0
      }
    }
    result.set(member.id,{x:candidate.x,y:candidate.y})
    placed.push(candidate)
    columnWidth = Math.max(columnWidth,member.width)
    y = candidate.y + member.height + gapY
  }
  return result
}
