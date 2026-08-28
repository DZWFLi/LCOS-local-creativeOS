import { describe, expect, it } from 'vitest'
import { materializeProjectEntityNodes, projectEntityNodeId, projectEntityNodeIds, semanticRefsForSourceIds } from '../projectEntityProjection'
import type { CanvasNode } from '../../../model'

const CONVERSATION_VIEW: CanvasNode = {
  id: 'view-conversation-a',
  kind: 'context',
  entityKind: 'conversation',
  title: '架构裁定记录',
  subtitle: '21 条消息',
  x: 713,
  y: 244,
  width: 148,
  height: 92,
  conversation: { id: 'conv-a', title: '架构裁定记录', messageCount: 21 },
}

const NODES: readonly CanvasNode[] = [
  { id: 'view-a', kind: 'working', title: '材料 A', subtitle: '', x: 100, y: 200, width: 220, height: 112 },
  CONVERSATION_VIEW,
]

describe('projectEntityProjection: canonical Conversation View', () => {
  it('never fabricates an id for a Conversation ref; non-Conversation ids stay deterministic', () => {
    expect(projectEntityNodeId({ type: 'view', id: 'v1' })).toBe('v1')
    expect(projectEntityNodeId({ type: 'scope', id: 's1' })).toBe('scope:s1')
    expect(projectEntityNodeId({ type: 'workspace', id: 'w1' })).toBe('workspace:w1')
  })

  it('resolves Conversation refs to an existing Core-backed conversationViewId only', () => {
    expect(projectEntityNodeIds([{ type: 'conversation', id: 'conv-a' }], NODES)).toEqual(['view-conversation-a'])
    expect(projectEntityNodeIds([{ type: 'conversation', id: 'conv-missing' }], NODES)).toEqual([])
  })

  it('materializes the real Conversation node without rewriting identity, position, or morphology', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-a' }], NODES, [], [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBe(CONVERSATION_VIEW)
    expect(nodes[0]).toMatchObject({ id: 'view-conversation-a', x: 713, y: 244, entityKind: 'conversation' })
  })

  it('missing Conversation truth yields no projection instead of a pseudo node', () => {
    expect(materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-missing' }], NODES, [], [])).toEqual([])
  })

  it('view refs remain the original Project View', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'view', id: 'view-a' }], NODES, [], [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBe(NODES[0])
  })
})

describe('semanticRefsForSourceIds: Conversation round-trip', () => {
  it('maps the canonical physical Conversation View back to a semantic Conversation ref', () => {
    const result = semanticRefsForSourceIds(['view-conversation-a', 'view-a'], NODES)
    expect(result.entityRefs).toEqual([{ type: 'conversation', id: 'conv-a' }])
    expect(result.viewIds).toEqual(['view-a'])
  })

  it('does not recognize a synthetic conversation:<sessionId> id when no real node exists', () => {
    const result = semanticRefsForSourceIds(['conversation:conv-a'], NODES)
    expect(result.entityRefs).toEqual([])
    expect(result.viewIds).toEqual([])
  })
})
