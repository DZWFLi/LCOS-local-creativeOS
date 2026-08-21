import type { CanvasEdge } from '../../model'

export type LayoutStrategy = 'manual' | 'layered' | 'relational'
export type LayoutEngineId = 'manual' | 'builtin-layered' | 'builtin-relational' | 'elk' | 'fcose'

export interface LayoutNodeInput {
  id: string
  x: number
  y: number
  width: number
  height: number
  pinned?: boolean
}

export interface LayoutEdgeInput {
  id: string
  from: string
  to: string
  kind?: CanvasEdge['kind']
}

export interface LayoutPoint { x: number; y: number }
export interface LayoutPosition extends LayoutPoint { id: string }
export interface LayoutRoute { id: string; points: readonly LayoutPoint[] }

export interface LayoutRequest {
  nodes: readonly LayoutNodeInput[]
  edges: readonly LayoutEdgeInput[]
  strategy: LayoutStrategy
  gap?: number
  componentGap?: number
  origin?: LayoutPoint
  preserveManualAnchors?: boolean
}

export interface LayoutResult {
  engine: LayoutEngineId
  strategy: LayoutStrategy
  positions: readonly LayoutPosition[]
  routes: readonly LayoutRoute[]
  componentCount: number
  movedIds: readonly string[]
}

export interface LayoutEngine {
  id: LayoutEngineId
  strategy: Exclude<LayoutStrategy, 'manual'>
  layout(request: LayoutRequest): Promise<LayoutResult>
}
