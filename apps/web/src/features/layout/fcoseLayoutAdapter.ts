import { layoutConnectedComponents } from './layoutGraph'
import { movedLayoutIds, removeLayoutOverlaps, routeLayoutEdges } from './layoutGeometry'
import type { LayoutEngine, LayoutPoint, LayoutRequest, LayoutResult } from './layoutTypes'

export interface FcoseDriverRequest {
  nodes: Array<{ id: string; position: LayoutPoint; width: number; height: number }>
  edges: Array<{ id: string; source: string; target: string }>
  options: Record<string, unknown>
}
export interface FcoseDriverResult extends Record<string, LayoutPoint> {}
export interface FcoseDriver { run(request: FcoseDriverRequest): Promise<FcoseDriverResult> }

export function fcoseOptions(request: LayoutRequest): Record<string, unknown> {
  const pinned = request.nodes.filter((node) => node.pinned)
  return {
    name: 'fcose',
    quality: 'default',
    randomize: false,
    animate: false,
    fit: false,
    packComponents: false,
    nodeSeparation: Math.max(68, (request.gap ?? 30) * 2.2),
    idealEdgeLength: Math.max(120, (request.gap ?? 30) * 4),
    fixedNodeConstraint: pinned.map((node) => ({ nodeId: node.id, position: { x: node.x + node.width / 2, y: node.y + node.height / 2 } })),
  }
}

/** fCoSE integration boundary with exact fixed-node constraints and no Cytoscape state leakage. */
export function createFcoseLayoutEngine(driver: FcoseDriver): LayoutEngine {
  return {
    id: 'fcose', strategy: 'relational',
    async layout(request: LayoutRequest): Promise<LayoutResult> {
      const centers = await driver.run({
        nodes: request.nodes.map((node) => ({ id: node.id, position: { x: node.x + node.width / 2, y: node.y + node.height / 2 }, width: node.width, height: node.height })),
        edges: request.edges.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to })),
        options: fcoseOptions(request),
      })
      let positions = request.nodes.map((node) => {
        const center = centers[node.id]
        if (!center || node.pinned) return { id: node.id, x: node.x, y: node.y }
        return { id: node.id, x: center.x - node.width / 2, y: center.y - node.height / 2 }
      })
      positions = removeLayoutOverlaps(request.nodes, positions, request.gap ?? 30)
      return { engine: 'fcose', strategy: 'relational', positions, routes: routeLayoutEdges(request.nodes, positions, request.edges), componentCount: layoutConnectedComponents(request.nodes, request.edges).length, movedIds: movedLayoutIds(request.nodes, positions) }
    },
  }
}
