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

function layoutBalancedGrid(
  container: CanvasNode,
  members: readonly CanvasNode[],
  obstacles: readonly CanvasNode[],
  gapX: number,
  gapY: number,
  maxColumns: number,
): ReadonlyMap<string,{x:number;y:number}> {
  const ordered = [...members].sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id))
  const columns = Math.max(3, Math.min(maxColumns, Math.ceil(Math.sqrt(ordered.length))))
  const rows = Math.ceil(ordered.length / columns)
  const columnWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)
  ordered.forEach((member, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, member.width)
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, member.height)
  })
  const columnOffsets: number[] = []
  const rowOffsets: number[] = []
  let xCursor = 0
  columnWidths.forEach((width, index) => { columnOffsets[index] = xCursor; xCursor += width + gapX })
  let yCursor = 0
  rowHeights.forEach((height, index) => { rowOffsets[index] = yCursor; yCursor += height + gapY })
  const blockWidth = Math.max(1, xCursor - gapX)
  const blockHeight = Math.max(1, yCursor - gapY)

  // Move the whole expansion body around unrelated obstacles. Never repair
  // collisions by pushing one member endlessly downward: that is what caused
  // 10+ member Collections to degrade into a one-column snake.
  const baseX = container.x + container.width + gapX + 12
  const baseY = container.y
  const candidateOrigins = [
    { x: baseX, y: baseY },
    { x: baseX, y: baseY - blockHeight * .35 },
    { x: baseX, y: baseY + container.height + gapY },
    { x: container.x, y: container.y + container.height + gapY + 18 },
    { x: container.x - blockWidth - gapX - 18, y: baseY },
  ]
  const blockRect = (origin: { x: number; y: number }) => ({ x: origin.x, y: origin.y, width: blockWidth, height: blockHeight })
  const origin = candidateOrigins.find((candidate) => obstacles.every((obstacle) => !intersects(blockRect(candidate), obstacle, 20))) ?? candidateOrigins[0]!

  const result = new Map<string,{x:number;y:number}>()
  ordered.forEach((member, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    result.set(member.id, { x: origin.x + (columnOffsets[column] ?? 0), y: origin.y + (rowOffsets[row] ?? 0) })
  })
  return result
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
  const maxColumns = Math.max(1, options.maxColumns ?? (members.length > 16 ? 5 : 4))

  if (members.length > 9) {
    return layoutBalancedGrid(container, members, obstacles, Math.max(26, columnGap), gapY, maxColumns)
  }

  // Keep the familiar small-Collection unfold behavior that already feels
  // good for 2-9 members.
  const ordered = [...members].sort((a,b)=>Math.abs(a.y-container.y)-Math.abs(b.y-container.y)||a.y-b.y||a.x-b.x)
  const result = new Map<string,{x:number;y:number}>()
  const placed: CanvasNode[] = []
  let column = 0
  let x = container.x + container.width + gapX
  let y = container.y
  let columnWidth = 0
  const columnStartY = y
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
