import type { PresentationEntityRefV0 } from '@local-creative-os/contracts'
import type { CanvasNode, CanvasNodeConversation, CanvasScope, Workspace } from '../../model'

export function projectEntityNodeId(ref: PresentationEntityRefV0): string {
  if (ref.type === 'workspace') return `workspace:${ref.id}`
  if (ref.type === 'scope') return `scope:${ref.id}`
  if (ref.type === 'conversation') return `conversation:${ref.id}`
  return ref.id
}

/** Conversation 列锚点常量（确定性派生）：沿既有节点包围盒右侧外扩一列，无节点时落固定锚点。 */
const CONVERSATION_COLUMN_GAP = 96
const CONVERSATION_ROW_STRIDE = 170
const CONVERSATION_FALLBACK_X = 480
const CONVERSATION_FALLBACK_Y = 360
const CONVERSATION_NODE_WIDTH = 180
/** 锚点视口参考尺寸：与 spatialOverviewProjection 的默认 viewport 一致。 */
const VIEWPORT_REFERENCE_WIDTH = 1440
const VIEWPORT_REFERENCE_HEIGHT = 900
const CONVERSATION_NODE_HEIGHT = 132

export function materializeProjectEntityNodes(
  refs: readonly PresentationEntityRefV0[],
  nodes: readonly CanvasNode[],
  scopes: readonly CanvasScope[],
  workspaces: readonly Workspace[],
  /** Wave C-2（批八）：App 内已加载的 conversationSessions（可选，既有调用点零改动）。 */
  conversations: readonly CanvasNodeConversation[] = [],
): CanvasNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]))
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]))
  // 确定性槽位：按 id 排序派生（与 refs 传入顺序无关），同 id 永远同槽——同输入同位置。
  const conversationSlotById = new Map(
    [...conversationById.keys()].sort((a, b) => a.localeCompare(b)).map((id, slot) => [id, slot] as const),
  )
  // 列锚点（批十修正）：优先落在根 scope 相机视口内右侧——大画布（≥48 节点）时
  // spatialOverviewProjection 会剔除视口外节点，旧「包围盒最右+96」锚点会把对话列
  // 放到用户视野之外导致零渲染；无 scope 相机时回退包围盒右列（既有测试路径）。
  const rootScope = scopes.find((scope) => scope.kind === 'root') ?? scopes[0]
  const conversationAnchor = rootScope?.camera
    ? {
        x: -rootScope.camera.x / Math.max(0.1, rootScope.camera.zoom) + (VIEWPORT_REFERENCE_WIDTH / Math.max(0.1, rootScope.camera.zoom)) * 0.78,
        y: -rootScope.camera.y / Math.max(0.1, rootScope.camera.zoom) + (VIEWPORT_REFERENCE_HEIGHT / Math.max(0.1, rootScope.camera.zoom)) * 0.12,
      }
    : nodes.length
      ? {
        x: Math.max(...nodes.map((node) => node.x + node.width)) + CONVERSATION_COLUMN_GAP,
        y: Math.min(...nodes.map((node) => node.y)),
      }
    : { x: CONVERSATION_FALLBACK_X, y: CONVERSATION_FALLBACK_Y }
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
        // Presentation identity is the Entity, never the compatibility proxy View.
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
      const conversation = conversationById.get(ref.id)
      if (!conversation) return []
      const slot = conversationSlotById.get(conversation.id) ?? 0
      return [{
        id: `conversation:${conversation.id}`,
        kind: 'context',
        entityKind: 'conversation',
        title: conversation.title,
        subtitle: `${conversation.messageCount ?? 0} 条消息`,
        x: conversationAnchor.x,
        y: conversationAnchor.y + slot * CONVERSATION_ROW_STRIDE,
        width: CONVERSATION_NODE_WIDTH,
        height: CONVERSATION_NODE_HEIGHT,
        displayMode: 'standard',
        // 最小字段集：只携带 Glyth 投影所需（id/title/活动度时间戳），不复制整个会话实体。
        conversation: {
          id: conversation.id,
          title: conversation.title,
          ...(conversation.messageCount !== undefined ? { messageCount: conversation.messageCount } : {}),
          ...(conversation.updatedAt !== undefined ? { updatedAt: conversation.updatedAt } : {}),
          ...(conversation.lastOpenedAt !== undefined ? { lastOpenedAt: conversation.lastOpenedAt } : {}),
          ...(conversation.lastRunAt !== undefined ? { lastRunAt: conversation.lastRunAt } : {}),
          ...(conversation.lastSelectedAsControllerAt !== undefined ? { lastSelectedAsControllerAt: conversation.lastSelectedAsControllerAt } : {}),
        },
      } satisfies CanvasNode]
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
    if (id.startsWith('conversation:')) {
      entityRefs.push({ type: 'conversation', id: id.slice('conversation:'.length) })
      return
    }
    const node = byId.get(id)
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
