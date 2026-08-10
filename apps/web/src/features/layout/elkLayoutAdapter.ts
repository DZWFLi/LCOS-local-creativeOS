import { layoutConnectedComponents } from './layoutGraph'
import { movedLayoutIds, removeLayoutOverlaps, routeLayoutEdges } from './layoutGeometry'
import type { LayoutEngine, LayoutRequest, LayoutResult } from './layoutTypes'

interface ElkChild { id: string; x?: number; y?: number; width?: number; height?: number }
interface ElkGraph { id: string; children?: ElkChild[]; edges?: Array<{ id: string; sources: string[]; targets: string[] }>; layoutOptions?: Record<string, string> }
export interface ElkLike { layout(graph: ElkGraph): Promise<ElkGraph> }

/**
 * Dependency-injected adapter. LCOS owns truth/anchors; ELK only computes Presentation geometry.
 * The package can be wired later without coupling Project Truth to elkjs types.
 */
export function createElkLayoutEngine(elk: ElkLike): LayoutEngine {
  return {
    id: 'elk', strategy: 'layered',
    async layout(request: LayoutRequest): Promise<LayoutResult> {
      const graph: ElkGraph = {
        id: 'lcos-layout-root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.spacing.nodeNode': String(request.gap ?? 30),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.max(92, (request.gap ?? 30) * 2.8)),
        },
        children: request.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height })),
        edges: request.edges.map((edge) => ({ id: edge.id, sources: [edge.from], targets: [edge.to] })),
      }
      const laidOut = await elk.layout(graph)
      const byNode = new Map(request.nodes.map((node) => [node.id, node]))
      let positions = (laidOut.children ?? []).flatMap((child) => {
        const node = byNode.get(child.id)
        if (!node || child.x === undefined || child.y === undefined) return []
        return [{ id: child.id, x: node.pinned ? node.x : child.x, y: node.pinned ? node.y : child.y }]
      })
      // Exact LCOS anchors are enforced after engine output; engine never owns manual intent.
      positions = removeLayoutOverlaps(request.nodes, positions, request.gap ?? 30)
      return { engine: 'elk', strategy: 'layered', positions, routes: routeLayoutEdges(request.nodes, positions, request.edges, true), componentCount: layoutConnectedComponents(request.nodes, request.edges).length, movedIds: movedLayoutIds(request.nodes, positions) }
    },
  }
}
