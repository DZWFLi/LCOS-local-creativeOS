import { builtinLayout } from './builtinLayoutEngines'
import type { LayoutEngine, LayoutRequest, LayoutResult, LayoutStrategy } from './layoutTypes'

export interface LayoutEngineRegistry {
  layered?: LayoutEngine
  relational?: LayoutEngine
}

/**
 * Phase 2：关系优先路由（LCOS_FINAL_GUI_CAPTURE_PHASE_1_5 §5.1）。
 * 阈值是产品调优参数，不是语义真相；有测试夹具钉住。
 */
export type RelationFirstLayoutMode = 'elk-directed' | 'fcose-relation' | 'manual'

export function chooseRelationFirstLayoutMode(input: {
  readonly nodeCount: number
  readonly edgeCount: number
  readonly directedRatio: number
  readonly hasHierarchy: boolean
  readonly userRequestedFree: boolean
}): RelationFirstLayoutMode {
  if (input.userRequestedFree) return 'manual'
  if (input.nodeCount < 2 || input.edgeCount === 0) return 'manual'
  if (input.hasHierarchy || input.directedRatio >= 0.6) return 'elk-directed'
  return 'fcose-relation'
}

export function chooseLayoutStrategy(request: Omit<LayoutRequest, 'strategy'>): LayoutStrategy {
  const nodeIds = new Set(request.nodes.map((node) => node.id))
  const edges = request.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  const directed = edges.filter((edge) => edge.kind !== 'reference')
  const mode = chooseRelationFirstLayoutMode({
    nodeCount: request.nodes.length,
    edgeCount: edges.length,
    directedRatio: edges.length ? directed.length / edges.length : 0,
    hasHierarchy: edges.some((edge) => edge.kind === 'hierarchy'),
    userRequestedFree: false,
  })
  if (mode === 'elk-directed') return 'layered'
  if (mode === 'fcose-relation') return 'relational'
  return 'manual'
}

export function layoutPreviewSync(request: LayoutRequest): LayoutResult {
  return builtinLayout(request)
}

/** External engines are optional accelerators/refiners, never required for LCOS to remain usable offline. */
export async function layoutPreview(request: LayoutRequest, engines: LayoutEngineRegistry = {}): Promise<LayoutResult> {
  const engine = request.strategy === 'layered' ? engines.layered : request.strategy === 'relational' ? engines.relational : undefined
  if (!engine) return builtinLayout(request)
  try { return await engine.layout(request) } catch { return builtinLayout(request) }
}
