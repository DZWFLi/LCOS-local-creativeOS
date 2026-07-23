import type { CanvasEdge, CanvasNode, CanvasScope, ScopeKind } from '../model'

export interface CreateChildScopeInput {
  parentScopeId: string
  label: string
  kind: Exclude<ScopeKind, 'root'>
  selectedIds: string[]
  containerPosition: { x: number; y: number }
  createId: (prefix: string) => string
}

export interface CreateChildScopeResult {
  scope: CanvasScope
  container: CanvasNode
  views: CanvasNode[]
  edges: CanvasEdge[]
  sourceToView: Map<string, string>
}

const COLUMN_X: Record<CanvasNode['kind'], number> = {
  source: 70,
  context: 70,
  working: 390,
  generated: 740,
  process: 390,
  decision: 700,
  note: 390,
}

export function createChildScopeFromSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  input: CreateChildScopeInput,
): CreateChildScopeResult {
  const scopeId = input.createId('scope')
  const containerId = input.createId('collection')
  const selected = nodes.filter((node) => input.selectedIds.includes(node.id))
  const sourceToView = new Map<string, string>()
  const familyRows = new Map<CanvasNode['kind'], number>()

  const views = selected.map((node) => {
    const row = familyRows.get(node.kind) ?? 0
    familyRows.set(node.kind, row + 1)
    const id = input.createId('view')
    sourceToView.set(node.id, id)
    return {
      ...node,
      id,
      artifactId: node.artifactId ?? node.viewOf ?? node.id,
      viewOf: node.artifactId ?? node.viewOf ?? node.id,
      scopeId,
      workspaceIds: undefined,
      x: COLUMN_X[node.kind],
      y: node.kind === 'process' || node.kind === 'decision' || node.kind === 'note'
        ? 520 + row * Math.max(112, node.height + 24)
        : 110 + row * Math.max(154, node.height + 34),
      positionLocked: false,
      opensScopeId: undefined,
    } satisfies CanvasNode
  })

  const internalEdges = edges
    .filter((edge) => sourceToView.has(edge.from) && sourceToView.has(edge.to))
    .map((edge) => ({
      ...edge,
      id: input.createId('edge'),
      from: sourceToView.get(edge.from)!,
      to: sourceToView.get(edge.to)!,
      active: false,
    }))

  const container: CanvasNode = {
    id: containerId,
    artifactId: input.createId('artifact-collection'),
    kind: 'context',
    title: input.label,
    subtitle: `${selected.length} 个对象 · 双击进入子画布`,
    x: input.containerPosition.x,
    y: input.containerPosition.y,
    width: 250,
    height: 146,
    displayMode: 'standard',
    scopeId: input.parentScopeId,
    opensScopeId: scopeId,
    contextOnly: true,
  }

  const scope: CanvasScope = {
    id: scopeId,
    label: input.label,
    kind: input.kind,
    parentScopeId: input.parentScopeId,
    containerNodeId: containerId,
    camera: { x: 180, y: 92, zoom: 1 },
    layoutMode: 'semantic',
    updatedAt: new Date().toISOString(),
  }

  return { scope, container, views, edges: internalEdges, sourceToView }
}

export function removeScopeTree(scopes: CanvasScope[], nodes: CanvasNode[], edges: CanvasEdge[], scopeId: string): {
  scopes: CanvasScope[]
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  removedScopeIds: string[]
} {
  const removed = new Set<string>()
  const visit = (id: string) => {
    removed.add(id)
    scopes.filter((scope) => scope.parentScopeId === id).forEach((child) => visit(child.id))
  }
  visit(scopeId)
  const removedNodeIds = new Set(nodes.filter((node) => node.scopeId && removed.has(node.scopeId)).map((node) => node.id))
  return {
    scopes: scopes.filter((scope) => !removed.has(scope.id)),
    nodes: nodes.filter((node) => !removedNodeIds.has(node.id)),
    edges: edges.filter((edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to)),
    removedScopeIds: [...removed],
  }
}
