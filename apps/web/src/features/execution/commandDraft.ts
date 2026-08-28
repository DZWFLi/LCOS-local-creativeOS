import type { ConnectedConversationV1, OrderedRunReferenceV2, RunReceiverRefV1 } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'

export interface ComposerReferenceCandidate {
  readonly node: CanvasNode
  readonly supported: boolean
  readonly orderedReference?: OrderedRunReferenceV2
  readonly reason?: string
}

export interface ComposerReceiverResolution {
  readonly receiver: RunReceiverRefV1 | null
  readonly reason?: string
  readonly selectedConversationCount: number
}

function nodeScopeId(node: CanvasNode): string | null {
  if (node.opensScopeId) return node.opensScopeId
  if (node.id.startsWith('scope:')) return node.id.slice('scope:'.length)
  if (node.entityKind === 'context' || node.entityKind === 'workflow' || node.entityKind === 'collection') return node.scopeId ?? null
  return null
}

export function orderedReferenceForNode(node: CanvasNode, order: number): ComposerReferenceCandidate {
  if (node.entityKind === 'conversation' && node.conversation?.id) {
    return { node, supported: true, orderedReference: { ref: { type: 'conversation', conversationSessionId: node.conversation.id }, order } }
  }
  const scopeId = nodeScopeId(node)
  if (scopeId) return { node, supported: true, orderedReference: { ref: { type: 'scope', scopeId }, order, mode: 'structure' } }
  if (node.entityKind === 'workspace') {
    const workspaceId = node.id.startsWith('workspace:') ? node.id.slice('workspace:'.length) : null
    return workspaceId
      ? { node, supported: true, orderedReference: { ref: { type: 'workspace', workspaceId }, order, mode: 'structure' } }
      : { node, supported: false, reason: 'Workspace 缺稳定 workspaceId，不能猜引用身份。' }
  }
  if (node.artifactId) {
    return {
      node,
      supported: true,
      orderedReference: {
        ref: { type: 'artifact', artifactId: node.artifactId, ...(node.revisionId ? { revisionId: node.revisionId } : {}) },
        order,
      },
    }
  }
  if (node.viewOf || node.id.startsWith('view:')) {
    return { node, supported: true, orderedReference: { ref: { type: 'view', viewId: node.id }, order } }
  }
  // F6 follow-up：Note / Resource canonical ref 未闭合前必须 fail-close。
  return { node, supported: false, reason: '当前 Core 还没有这类对象的 canonical RunReference，已阻止伪造引用。' }
}

export function resolveComposerReceiver(
  selectedNodes: readonly CanvasNode[],
  conversations: readonly ConnectedConversationV1[],
  activeReceiverId: string | null,
): ComposerReceiverResolution {
  const selectedConversationSessionIds = selectedNodes
    .filter((node) => node.entityKind === 'conversation' && node.conversation?.id)
    .map((node) => node.conversation!.id)
  const linked = conversations.filter((conversation) => conversation.conversationSessionId && selectedConversationSessionIds.includes(conversation.conversationSessionId))
  if (linked.length === 1) return { receiver: { connectedConversationId: linked[0]!.id }, selectedConversationCount: selectedConversationSessionIds.length }
  if (linked.length > 1 || selectedConversationSessionIds.length > 1) {
    return { receiver: null, reason: '一次 Run 只能有一只 Receiver Glyth，请明确选择一段 Conversation。', selectedConversationCount: selectedConversationSessionIds.length }
  }
  if (selectedConversationSessionIds.length === 1 && linked.length === 0) {
    return { receiver: null, reason: '选中的 Glyth 尚未显式链接 ConnectedConversation，不能猜 Session。', selectedConversationCount: 1 }
  }
  if (activeReceiverId) return { receiver: { connectedConversationId: activeReceiverId }, selectedConversationCount: 0 }
  return { receiver: null, reason: '当前没有可用 Receiver Glyth，请先选择或链接一段 Conversation。', selectedConversationCount: 0 }
}

export function referenceCandidates(
  referenceIds: readonly string[],
  nodes: readonly CanvasNode[],
  receiverId: string | null,
  conversations: readonly ConnectedConversationV1[],
): readonly ComposerReferenceCandidate[] {
  const receiverSessionId = receiverId === null ? null : conversations.find((conversation) => conversation.id === receiverId)?.conversationSessionId ?? null
  const selected = referenceIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is CanvasNode => Boolean(node))
    .filter((node) => !node.resultSlotId)
    .filter((node) => !(node.entityKind === 'conversation' && receiverSessionId && node.conversation?.id === receiverSessionId))
  return selected.map((node, order) => orderedReferenceForNode(node, order))
}


export function proposalCompatibilityBlockReason(input: {
  readonly receiverId: string | null
  readonly activeReceiverId: string | null
  readonly receivers: readonly ConnectedConversationV1[]
  readonly references: readonly ComposerReferenceCandidate[]
}): string | undefined {
  if (!input.receiverId) return '请选择一只已链接的 Receiver Glyth。'
  const receiver = input.receivers.find((item) => item.id === input.receiverId)
  if (!receiver) return 'Receiver Glyth 已不在当前项目承接列表，请重新选择。'
  if (!receiver.conversationSessionId) return '这只 Glyth 尚未显式 link-session，不能猜真实 Session。'
  const unsupported = input.references.find((candidate) => !candidate.supported)
  if (unsupported) return unsupported.reason ?? '存在不能冻结的引用。'
  if (input.receiverId !== input.activeReceiverId) return 'Core Proposal 还未携带显式 Receiver；后端补洞前不会偷偷绕过 Proposal。'
  if (input.references.some((candidate) => candidate.orderedReference?.ref.type !== 'artifact')) return 'Core Proposal 仍是 Artifact-only；异构 Reference 会显示但在补洞前 fail-close。'
  return undefined
}
