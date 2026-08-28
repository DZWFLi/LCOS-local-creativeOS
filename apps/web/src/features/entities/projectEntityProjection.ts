import type { PresentationEntityRefV0 } from '@local-creative-os/contracts'
import type { CanvasNode, CanvasScope, Workspace } from '../../model'

export function projectEntityNodeId(ref: Exclude<PresentationEntityRefV0, { readonly type: 'conversation' }>): string {
  if (ref.type === 'workspace') return `workspace:${ref.id}`
  if (ref.type === 'scope') return `scope:${ref.id}`
  return ref.id
}

/** Resolve Presentation refs to real canvas identities. Conversation is special:
 * its physical body is the canonical Core-backed conversationViewId, never a
 * frontend-generated `conversation:<sessionId>` proxy. */
export function projectEntityNodeIds(refs: readonly PresentationEntityRefV0[], nodes: readonly CanvasNode[]): string[] {
  const ids = refs.flatMap((ref) => {
    if (ref.type !== 'conversation') return [projectEntityNodeId(ref)]
    const node = nodes.find((item) => item.entityKind === 'conversation' && item.conversation?.id === ref.id)
    return node ? [node.id] : []
  })
  return [...new Set(ids)]
}

export function materializeProjectEntityNodes(
  refs: readonly PresentationEntityRefV0[],
  nodes: readonly CanvasNode[],
  scopes: readonly CanvasScope[],
  workspaces: readonly Workspace[],
): CanvasNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]))
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const seen = new Set<string>()
  return refs.flatMap((ref, index) => {
    const key = `${ref.type}:${ref.id}`
    if (seen.has(key)) return []
    seen.add(key)
    if (ref.type === 'view') {
      const node = nodeById.get(ref.id)
      return node ? [node] : []
    }
    if (ref.type === 'scope') {
      const scope = scopeById.get(ref.id)
      if (!scope) return []
      const container = scope.containerNodeId ? nodeById.get(scope.containerNodeId) : nodes.find((node) => node.opensScopeId === scope.id)
      if (container) return [{
        ...container,
        id: `scope:${scope.id}`,
        artifactId: undefined,
        viewOf: undefined,
        opensScopeId: scope.id,
        entityKind: scope.kind === 'context' ? 'context' : scope.kind === 'workflow' ? 'workflow' : 'collection',
      }]
      return [{
        id: `scope:${scope.id}`,
        kind: 'context',
        entityKind: scope.kind === 'context' ? 'context' : scope.kind === 'workflow' ? 'workflow' : 'collection',
        title: scope.label,
        subtitle: scope.kind === 'context' ? 'Context' : scope.kind === 'workflow' ? 'Workflow' : 'Collection',
        x: 120 + (index % 4) * 260,
        y: 120 + Math.floor(index / 4) * 170,
        width: 220,
        height: 112,
        displayMode: 'standard',
        scopeId: scope.parentScopeId ?? undefined,
        opensScopeId: scope.id,
      } satisfies CanvasNode]
    }
    if (ref.type === 'conversation') {
      const existing = nodes.find((node) => node.entityKind === 'conversation' && node.conversation?.id === ref.id)
      return existing ? [existing] : []
    }
    const workspace = workspaceById.get(ref.id)
    if (!workspace) return []
    const frame = workspace.frameBounds
    return [{
      id: `workspace:${workspace.id}`,
      kind: 'context',
      entityKind: 'workspace',
      title: workspace.label,
      subtitle: `${workspace.focusedViewIds.length} 项 · 工作现场`,
      x: frame?.x ?? 140 + (index % 4) * 260,
      y: frame?.y ?? 140 + Math.floor(index / 4) * 170,
      width: Math.max(220, Math.min(frame?.width ?? 240, 340)),
      height: 112,
      displayMode: 'standard',
      scopeId: workspace.scopeId,
    } satisfies CanvasNode]
  })
}

export function semanticRefsForSourceIds(
  sourceIds: readonly string[],
  nodes: readonly CanvasNode[],
): { viewIds: string[]; entityRefs: PresentationEntityRefV0[] } {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const viewIds: string[] = []
  const entityRefs: PresentationEntityRefV0[] = []
  sourceIds.forEach((id) => {
    if (id.startsWith('workspace:')) {
      entityRefs.push({ type: 'workspace', id: id.slice('workspace:'.length) })
      return
    }
    if (id.startsWith('scope:')) {
      entityRefs.push({ type: 'scope', id: id.slice('scope:'.length) })
      return
    }
    const node = byId.get(id)
    if (node?.entityKind === 'conversation' && node.conversation) {
      entityRefs.push({ type: 'conversation', id: node.conversation.id })
      return
    }
    if (node?.opensScopeId && node.entityKind && node.entityKind !== 'workspace') {
      entityRefs.push({ type: 'scope', id: node.opensScopeId })
      return
    }
    if (node) viewIds.push(id)
  })
  return {
    viewIds: [...new Set(viewIds)],
    entityRefs: [...new Map(entityRefs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()],
  }
}
