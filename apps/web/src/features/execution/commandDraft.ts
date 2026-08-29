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
      : { node, supported: false, reason: '这个工作现场还没有稳定的引用身份，暂时不能作为本次参考。' }
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
  return { node, supported: false, reason: '这类对象目前还不能安全加入本次参考。' }
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
    return { receiver: null, reason: '一次处理只能交给一段对话，请明确选择。', selectedConversationCount: selectedConversationSessionIds.length }
  }
  if (selectedConversationSessionIds.length === 1 && linked.length === 0) {
    return { receiver: null, reason: '选中的对话还没有完成连接，请先连接后再使用。', selectedConversationCount: 1 }
  }
  if (activeReceiverId) return { receiver: { connectedConversationId: activeReceiverId }, selectedConversationCount: 0 }
  return { receiver: null, reason: '当前没有可用的承接对话，请先选择或连接一段对话。', selectedConversationCount: 0 }
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

/**
 * Selection and Reference are different interaction truths, but both are foreground
 * execution context. Keep one deterministic ordered list for Proposal / Run without
 * mutating either UI set. The explicit Reference Set keeps its order after Selection.
 */
export function mergeExecutionReferenceIds(
  selectionIds: readonly string[],
  referenceIds: readonly string[],
  targetId?: string | null,
): readonly string[] {
  const merged: string[] = []
  for (const id of [...selectionIds, ...referenceIds]) {
    if (id === targetId || merged.includes(id)) continue
    merged.push(id)
  }
  return merged
}


export function proposalCompatibilityBlockReason(input: {
  readonly receiverId: string | null
  readonly activeReceiverId: string | null
  readonly receivers: readonly ConnectedConversationV1[]
  readonly references: readonly ComposerReferenceCandidate[]
}): string | undefined {
  if (!input.receiverId) return '请选择一段已连接的对话。'
  const receiver = input.receivers.find((item) => item.id === input.receiverId)
  if (!receiver) return '这段对话已经不在当前项目的可用列表里，请重新选择。'
  if (!receiver.conversationSessionId) return '这段对话还没有完成连接，请先连接后再使用。'
  const unsupported = input.references.find((candidate) => !candidate.supported)
  if (unsupported) return unsupported.reason ?? '存在不能冻结的引用。'
  return undefined
}
