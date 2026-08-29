import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../../../model'
import { clusterExtremeFarGlyths, glythSemanticLodForZoom, isCriticalGlyth } from '../glythSemanticLod'

function conversationNode(id: string, conversationId: string, x: number, y: number): CanvasNode {
  return {
    id,
    kind: 'context',
    entityKind: 'conversation',
    title: conversationId,
    subtitle: '',
    x,
    y,
    width: 180,
    height: 132,
    conversation: { id: conversationId, title: conversationId },
  }
}

describe('R2-B Glyth semantic LOD', () => {
  it('uses the shared four camera bands', () => {
    expect(glythSemanticLodForZoom(1)).toBe('normal')
    expect(glythSemanticLodForZoom(.72)).toBe('mid')
    expect(glythSemanticLodForZoom(.42)).toBe('far')
    expect(glythSemanticLodForZoom(.2)).toBe('extreme-far')
  })

  it('keeps selected, active and Focus/Search target Glyths critical', () => {
    const node = conversationNode('view-a', 'conversation-a', 0, 0)
    expect(isCriticalGlyth(node, { selectedIds: new Set(['view-a']) })).toBe(true)
    expect(isCriticalGlyth(node, { selectedIds: new Set(), activeConversationId: 'conversation-a' })).toBe(true)
    expect(isCriticalGlyth(node, { selectedIds: new Set(), focusIds: new Set(['view-a']) })).toBe(true)
    expect(isCriticalGlyth(node, { selectedIds: new Set() })).toBe(false)
  })

  it('clusters only nearby non-critical Conversation projections and never mutates them', () => {
    const a = conversationNode('view-a', 'conversation-a', 0, 0)
    const b = conversationNode('view-b', 'conversation-b', 40, 20)
    const critical = conversationNode('view-critical', 'conversation-c', 48, 24)
    const isolated = conversationNode('view-isolated', 'conversation-d', 2200, 1600)
    const snapshot = JSON.stringify([a, b, critical, isolated])
    const clusters = clusterExtremeFarGlyths([a, b, critical, isolated], { x: 0, y: 0, zoom: .2 }, new Set(['view-critical']))
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.memberIds).toEqual(['view-a', 'view-b'])
    expect(clusters[0]?.count).toBe(2)
    expect(JSON.stringify([a, b, critical, isolated])).toBe(snapshot)
  })
})
