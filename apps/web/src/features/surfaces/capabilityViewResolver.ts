import type { CanvasEdge, CanvasNode } from '../../model'
import type { ContextHistoryEntry } from './surfaceContracts'

export interface PresentationIntent {
  /** Saved or Agent-authored presentation set. Exact and never expanded. */
  readonly explicitViewIds?: readonly string[]
  /** Objects the user or Agent explicitly asked to see now. */
  readonly explicitObjectIds?: readonly string[]
  /** Local Workspace focus, used only when no stronger intent exists. */
  readonly workspaceFocusIds?: readonly string[]
  /** A presentation hint, never a Core membership rule. */
  readonly includeOneHop?: boolean
}

export interface ResolvedPresentation {
  readonly nodes: CanvasNode[]
  readonly edges: CanvasEdge[]
  readonly sourceKind: 'explicit' | 'conversation' | 'selection' | 'workspace' | 'process' | 'empty'
  readonly sourceLabel: string
}

const project = (nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], ids: ReadonlySet<string>): Pick<ResolvedPresentation, 'nodes' | 'edges'> => ({
  nodes: nodes.filter((node) => ids.has(node.id)),
  edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
})

const expandOneHop = (seedIds: readonly string[], edges: readonly CanvasEdge[]): Set<string> => {
  const seed = new Set(seedIds)
  const ids = new Set(seedIds)
  edges.forEach((edge) => {
    if (seed.has(edge.from)) ids.add(edge.to)
    if (seed.has(edge.to)) ids.add(edge.from)
  })
  return ids
}

const idsForIntent = (ids: readonly string[], edges: readonly CanvasEdge[], includeOneHop = false) => includeOneHop ? expandOneHop(ids, edges) : new Set(ids)

/** Presentation helper only; it never decides Core membership or Project Truth. */
export function resolveContextView(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], intent: PresentationIntent, history: readonly ContextHistoryEntry[]): ResolvedPresentation {
  if (intent.explicitViewIds !== undefined) {
    return { ...project(nodes, edges, new Set(intent.explicitViewIds)), sourceKind: 'explicit', sourceLabel: `Context · ${intent.explicitViewIds.length} 个对象` }
  }
  if (intent.explicitObjectIds?.length) {
    const ids = idsForIntent(intent.explicitObjectIds, edges, intent.includeOneHop)
    const sourceId = intent.explicitObjectIds.length === 1 ? intent.explicitObjectIds[0] : undefined
    const singleTitle = sourceId === undefined ? undefined : nodes.find((node) => node.id === sourceId)?.title
    return { ...project(nodes, edges, ids), sourceKind: 'selection', sourceLabel: singleTitle ? `${singleTitle} · 展开 1 hop` : `${intent.explicitObjectIds.length} 个明确对象${intent.includeOneHop ? ' · 推荐 1 hop' : ''}` }
  }
  const source = [...history].reverse().find((entry) => entry.current)
  if (source) {
    const ids = new Set([...source.objectIds, ...(source.sourceNodeId ? [source.sourceNodeId] : [])])
    return { ...project(nodes, edges, ids), sourceKind: 'conversation', sourceLabel: source.title || source.label }
  }
  if (intent.workspaceFocusIds?.length) {
    return { ...project(nodes, edges, new Set(intent.workspaceFocusIds)), sourceKind: 'workspace', sourceLabel: `Workspace Focus · ${intent.workspaceFocusIds.length} 个对象` }
  }
  return { nodes: [], edges: [], sourceKind: 'empty', sourceLabel: '尚未选择 Context 来源' }
}

/** Workflow recommendation that callers can override with any exact set. */
export function resolveWorkflowView(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[], intent: PresentationIntent): ResolvedPresentation {
  if (intent.explicitViewIds !== undefined) {
    return { ...project(nodes, edges, new Set(intent.explicitViewIds)), sourceKind: 'explicit', sourceLabel: `Workflow · ${intent.explicitViewIds.length} 个对象` }
  }
  if (intent.explicitObjectIds?.length) {
    const ids = idsForIntent(intent.explicitObjectIds, edges, intent.includeOneHop)
    return { ...project(nodes, edges, ids), sourceKind: 'selection', sourceLabel: `${intent.explicitObjectIds.length} 个明确对象${intent.includeOneHop ? ' · 推荐 1 hop' : ''}` }
  }
  if (intent.workspaceFocusIds?.length) {
    return { ...project(nodes, edges, new Set(intent.workspaceFocusIds)), sourceKind: 'workspace', sourceLabel: `Workspace Focus · ${intent.workspaceFocusIds.length} 个对象` }
  }
  // Workflow never invents membership from node kind. If the user has not
  // explicitly placed Project nodes here (or an old Workspace migration has not
  // seeded membership), the honest state is empty. Recommendations can be
  // proposed later, but they must not masquerade as members.
  return { nodes: [], edges: [], sourceKind: 'empty', sourceLabel: 'Workflow 暂无对象' }
}
