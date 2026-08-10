import { builtinLayout } from './builtinLayoutEngines'
import type { LayoutEngine, LayoutRequest, LayoutResult, LayoutStrategy } from './layoutTypes'

export interface LayoutEngineRegistry {
  layered?: LayoutEngine
  relational?: LayoutEngine
}

export function chooseLayoutStrategy(request: Omit<LayoutRequest, 'strategy'>): LayoutStrategy {
  if (request.nodes.length < 2) return 'manual'
  const nodeIds = new Set(request.nodes.map((node) => node.id))
  const edges = request.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  if (!edges.length) return 'manual'
  // Directed project relations generally benefit from layered layout; local relation renderers opt into relational explicitly.
  return 'layered'
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
