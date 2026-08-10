import type { CanvasEdge, CanvasNode } from '../../model'
import { layoutConnectedComponents } from '../layout/layoutGraph'
import { layoutPreviewSync } from '../layout/layoutService'
import { layoutBounds } from '../layout/layoutGeometry'
import type { SpatialPoint } from '../spatial/spatialTypes'

export interface ContextStrandItem {
  node: CanvasNode
  x: number
  y: number
  width: number
  height: number
  strand: number
}

export interface ContextStrandEdge {
  edge: CanvasEdge
  points: readonly { x: number; y: number }[]
  strand: number
}

export interface ContextStrandBand {
  id: string
  index: number
  x: number
  y: number
  width: number
  height: number
  objectIds: string[]
}

export interface ContextStrandLayout {
  items: ContextStrandItem[]
  edges: ContextStrandEdge[]
  strands: ContextStrandBand[]
  width: number
  height: number
}

const NODE_WIDTH = 190
const NODE_HEIGHT = 58
const X_ORIGIN = 340
const Y_ORIGIN = 110
const STRAND_GAP = 94

const chronology = (nodes: readonly CanvasNode[]) => [...nodes].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))

/** Relation-derived Context strands. No node kind or business-stage taxonomy participates in membership or grouping. */
export function layoutContextStrands(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): ContextStrandLayout {
  if (!nodes.length) return { items: [], edges: [], strands: [], width: 1200, height: 760 }
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const relevantEdges = edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to))
  const layoutNodes = nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }))
  let components = layoutConnectedComponents(layoutNodes, relevantEdges)

  // When relations are absent, chronology is a renderer fallback, not a claim of causality.
  if (!relevantEdges.length) {
    const ordered = chronology(nodes)
    const items = ordered.map((node, index) => ({ node, x: X_ORIGIN + index * (NODE_WIDTH + 74), y: Y_ORIGIN + 26, width: NODE_WIDTH, height: NODE_HEIGHT, strand: 0 }))
    const width = Math.max(1200, (items.at(-1)?.x ?? X_ORIGIN) + NODE_WIDTH + 180)
    return { items, edges: [], strands: [{ id: `strand:${ordered[0]?.id ?? 'chronology'}`, index: 0, x: X_ORIGIN - 28, y: Y_ORIGIN, width: width - X_ORIGIN - 90, height: NODE_HEIGHT + 52, objectIds: ordered.map((node) => node.id) }], width, height: 760 }
  }

  const dateRank = new Map(chronology(nodes).map((node, index) => [node.id, index]))
  components = [...components].sort((left, right) => Math.min(...left.nodes.map((node) => dateRank.get(node.id) ?? Number.MAX_SAFE_INTEGER)) - Math.min(...right.nodes.map((node) => dateRank.get(node.id) ?? Number.MAX_SAFE_INTEGER)))
  const items: ContextStrandItem[] = []
  const routed: ContextStrandEdge[] = []
  const strands: ContextStrandBand[] = []
  let cursorY = Y_ORIGIN
  let maxRight = 1200

  components.forEach((component, strand) => {
    const componentEdges = relevantEdges.filter((edge) => component.nodes.some((node) => node.id === edge.from) && component.nodes.some((node) => node.id === edge.to))
    const ordered = [...component.nodes].sort((a, b) => (dateRank.get(a.id) ?? 0) - (dateRank.get(b.id) ?? 0))
    const seedNodes = ordered.map((node, index) => ({ ...node, x: X_ORIGIN + index * (NODE_WIDTH + 70), y: cursorY + 24 }))
    const result = layoutPreviewSync({ strategy: componentEdges.length ? 'layered' : 'manual', nodes: seedNodes, edges: componentEdges, gap: 28, componentGap: 80, origin: { x: X_ORIGIN, y: cursorY + 24 }, preserveManualAnchors: true })
    const bounds = layoutBounds(seedNodes, result.positions) ?? { x: X_ORIGIN, y: cursorY, width: NODE_WIDTH, height: NODE_HEIGHT }
    const shiftX = X_ORIGIN - bounds.x
    const shiftY = cursorY + 24 - bounds.y
    const positions = new Map(result.positions.map((point) => [point.id, { x: point.x + shiftX, y: point.y + shiftY }]))
    component.nodes.forEach((layoutNode) => {
      const point = positions.get(layoutNode.id) ?? { x: X_ORIGIN, y: cursorY + 24 }
      const node = byId.get(layoutNode.id)
      if (node) items.push({ node, x: point.x, y: point.y, width: NODE_WIDTH, height: NODE_HEIGHT, strand })
    })
    result.routes.forEach((route) => {
      const edge = componentEdges.find((candidate) => candidate.id === route.id)
      if (!edge) return
      routed.push({ edge, strand, points: route.points.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })) })
    })
    const shifted = { x: bounds.x + shiftX - 28, y: bounds.y + shiftY - 18, width: bounds.width + 56, height: bounds.height + 36 }
    const anchorId = [...component.nodes].sort((left, right) => (dateRank.get(left.id) ?? 0) - (dateRank.get(right.id) ?? 0) || left.id.localeCompare(right.id))[0]?.id ?? String(strand)
    strands.push({ id: `strand:${anchorId}`, index: strand, ...shifted, objectIds: component.nodes.map((node) => node.id) })
    cursorY = shifted.y + shifted.height + STRAND_GAP
    maxRight = Math.max(maxRight, shifted.x + shifted.width + 160)
  })
  return { items, edges: routed, strands, width: maxRight, height: Math.max(760, cursorY + 100) }
}


/** Apply Presentation-only strand positions without mutating canonical node coordinates or relations. */
export function applyContextStrandPositions(layout: ContextStrandLayout, positions: Readonly<Record<string, SpatialPoint>>): ContextStrandLayout {
  if (!layout.strands.length || !Object.keys(positions).length) return layout
  const offsetByIndex = new Map<number, SpatialPoint>()
  const strands = layout.strands.map((strand) => {
    const position = positions[strand.id]
    if (!position) { offsetByIndex.set(strand.index, { x: 0, y: 0 }); return strand }
    const offset = { x: position.x - strand.x, y: position.y - strand.y }
    offsetByIndex.set(strand.index, offset)
    return { ...strand, x: position.x, y: position.y }
  })
  const offsetFor = (strand: number) => offsetByIndex.get(strand) ?? { x: 0, y: 0 }
  const items = layout.items.map((item) => { const offset = offsetFor(item.strand); return { ...item, x: item.x + offset.x, y: item.y + offset.y } })
  const edges = layout.edges.map((entry) => { const offset = offsetFor(entry.strand); return { ...entry, points: entry.points.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })) } })
  const maxRight = Math.max(layout.width, ...strands.map((strand) => strand.x + strand.width + 160), ...items.map((item) => item.x + item.width + 160))
  const maxBottom = Math.max(layout.height, ...strands.map((strand) => strand.y + strand.height + 120), ...items.map((item) => item.y + item.height + 120))
  return { ...layout, items, edges, strands, width: maxRight, height: maxBottom }
}
