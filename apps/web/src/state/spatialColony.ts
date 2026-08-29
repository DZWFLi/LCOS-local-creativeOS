import type { PresentationColonyV0, PresentationSpatialRegionV0 } from '@local-creative-os/contracts'
import type { CanvasNode } from '../model'

export type SpatialColonyDraft = PresentationColonyV0

const unique = (ids: readonly string[]) => [...new Set(ids.filter(Boolean))]

const nodeCorners = (node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>) => [
  { x: node.x, y: node.y },
  { x: node.x + node.width, y: node.y },
  { x: node.x + node.width, y: node.y + node.height },
  { x: node.x, y: node.y + node.height },
]

/**
 * Organic support contour around real member geometry. The points are durable
 * Presentation geometry; rendering smooths between them rather than turning
 * the Colony back into a rectangular Fence.
 */
export function colonyContourForMembers(memberIds: readonly string[], nodes: readonly CanvasNode[], padding = 30, samples = 16): PresentationColonyV0['contour'] | null {
  const selected = nodes.filter((node) => memberIds.includes(node.id))
  if (!selected.length) return null
  const corners = selected.flatMap(nodeCorners)
  const center = {
    x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
    y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length,
  }
  const points = Array.from({ length: Math.max(12, samples) }, (_, index) => {
    const angle = Math.PI * 2 * index / Math.max(12, samples)
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let support = corners[0]
    let best = -Infinity
    for (const point of corners) {
      const score = (point.x - center.x) * dx + (point.y - center.y) * dy
      if (score > best) { best = score; support = point }
    }
    return { x: support.x + dx * padding, y: support.y + dy * padding }
  })
  return { points }
}

export function colonyFromSelection(id: string, memberIds: readonly string[], nodes: readonly CanvasNode[], label?: string): SpatialColonyDraft | null {
  const ids = unique(memberIds)
  if (ids.length < 2) return null
  const contour = colonyContourForMembers(ids, nodes)
  if (!contour) return null
  return { id, label, surface: 'main', memberIds: ids, contour }
}

export function colonyFromLasso(id: string, points: readonly { x: number; y: number }[], nodes: readonly CanvasNode[], label?: string): SpatialColonyDraft | null {
  if (points.length < 3) return null
  const memberIds = nodes.filter((node) => pointInPolygon({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, points)).map((node) => node.id)
  if (memberIds.length < 2) return null
  return { id, label, surface: 'main', memberIds: unique(memberIds), contour: { points: smoothSampledLasso(points) } }
}

export function migrateLegacySpatialRegion(region: PresentationSpatialRegionV0, nodes: readonly CanvasNode[]): SpatialColonyDraft | null {
  const memberIds = nodes.filter((node) => {
    const x = node.x + node.width / 2
    const y = node.y + node.height / 2
    return x >= region.bounds.x && x <= region.bounds.x + region.bounds.width && y >= region.bounds.y && y <= region.bounds.y + region.bounds.height
  }).map((node) => node.id)
  if (memberIds.length < 2) return null
  const contour = colonyContourForMembers(memberIds, nodes)
  return contour ? { id: region.id, label: region.label, surface: 'main', memberIds: unique(memberIds), contour } : null
}

export function colonyBounds(colony: Pick<PresentationColonyV0, 'contour'>) {
  const xs = colony.contour.points.map((point) => point.x)
  const ys = colony.contour.points.map((point) => point.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

export function colonyPathData(colony: Pick<PresentationColonyV0, 'contour'>): string {
  const points = colony.contour.points
  if (points.length < 3) return ''
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const firstMid = mid(points[points.length - 1], points[0])
  let d = `M ${firstMid.x} ${firstMid.y}`
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const nextMid = mid(current, next)
    d += ` Q ${current.x} ${current.y} ${nextMid.x} ${nextMid.y}`
  }
  return `${d} Z`
}

export function pointInPolygon(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

export function distanceToPolygon(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): number {
  if (pointInPolygon(point, polygon)) return 0
  let best = Infinity
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const dx = b.x - a.x, dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
    const x = a.x + t * dx, y = a.y + t * dy
    best = Math.min(best, Math.hypot(point.x - x, point.y - y))
  }
  return best
}

export function addMembersToColony(colony: SpatialColonyDraft, ids: readonly string[], nodes: readonly CanvasNode[]): SpatialColonyDraft {
  const memberIds = unique([...colony.memberIds, ...ids])
  const contour = colonyContourForMembers(memberIds, nodes) ?? colony.contour
  return { ...colony, memberIds, contour }
}

export function rescopeColony(colony: SpatialColonyDraft, points: readonly { x: number; y: number }[], nodes: readonly CanvasNode[]): SpatialColonyDraft | null {
  const next = colonyFromLasso(colony.id, points, nodes, colony.label)
  return next ? { ...next, surface: colony.surface } : null
}

export function reconcileColonyAfterMove(colony: SpatialColonyDraft, movedIds: readonly string[], nodes: readonly CanvasNode[], peelDistance = 44): { colony: SpatialColonyDraft; peeledIds: string[] } {
  const moved = new Set(movedIds)
  const peeledIds: string[] = []
  const memberIds = colony.memberIds.filter((id) => {
    if (!moved.has(id)) return true
    const node = nodes.find((item) => item.id === id)
    if (!node) return false
    const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
    const peel = distanceToPolygon(center, colony.contour.points) > peelDistance
    if (peel) peeledIds.push(id)
    return !peel
  })
  const contour = colonyContourForMembers(memberIds, nodes) ?? colony.contour
  return { colony: { ...colony, memberIds, contour }, peeledIds }
}

function smoothSampledLasso(points: readonly { x: number; y: number }[]): Array<{ x: number; y: number }> {
  const sampled: Array<{ x: number; y: number }> = []
  const minDistance = 14
  for (const point of points) {
    const previous = sampled[sampled.length - 1]
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance) sampled.push({ ...point })
  }
  return sampled.length >= 8 ? sampled : points.map((point) => ({ ...point }))
}
