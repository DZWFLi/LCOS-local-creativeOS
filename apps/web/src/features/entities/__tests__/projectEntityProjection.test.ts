import { describe, expect, it } from 'vitest'
import type { ConversationSessionV1 } from '@local-creative-os/contracts'
import { materializeProjectEntityNodes, projectEntityNodeId, semanticRefsForSourceIds } from '../projectEntityProjection'
import type { CanvasNode } from '../../../model'

/**
 * Wave C-2（批八）契约测试：对话实体 → 画布节点投影（Grammar §8 / §8.3）。
 * 数值断言钉死：id 前缀 / entityKind / title / 确定性位置（同输入两次调用同位置、
 * 不同 id 不同位置、与 refs 传入顺序无关）/ 空画布固定锚点 / semanticRefs 回环。
 */

const NODES: readonly CanvasNode[] = [
  { id: 'view-a', kind: 'working', title: '材料 A', subtitle: '', x: 100, y: 200, width: 220, height: 112 },
  { id: 'view-b', kind: 'working', title: '材料 B', subtitle: '', x: 400, y: 80, width: 220, height: 112 },
]

function session(id: string, overrides: Partial<ConversationSessionV1> = {}): ConversationSessionV1 {
  return {
    schemaVersion: 1,
    id,
    projectId: 'proj-1',
    provider: 'codex',
    sourceKind: 'manual',
    title: `对话 ${id}`,
    messageCount: 12,
    sectionCount: 4,
    status: 'ready',
    originMeta: {},
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-27T09:00:00.000Z',
    ...overrides,
  }
}

const SESSIONS: readonly ConversationSessionV1[] = [
  session('conv-b', { title: '需求讨论·第三轮', messageCount: 7, lastRunAt: '2026-08-27T08:30:00.000Z' }),
  session('conv-a', { title: '架构裁定记录', messageCount: 21 }),
]

const CONVERSATION_REFS = SESSIONS.map((item) => ({ type: 'conversation' as const, id: item.id }))

describe('projectEntityNodeId：conversation 前缀', () => {
  it("conversation ref → 'conversation:<id>'", () => {
    expect(projectEntityNodeId({ type: 'conversation', id: 'conv-a' })).toBe('conversation:conv-a')
  })

  it('既有三类型语义不变（向后兼容）', () => {
    expect(projectEntityNodeId({ type: 'view', id: 'v1' })).toBe('v1')
    expect(projectEntityNodeId({ type: 'scope', id: 's1' })).toBe('scope:s1')
    expect(projectEntityNodeId({ type: 'workspace', id: 'w1' })).toBe('workspace:w1')
  })
})

describe('materializeProjectEntityNodes：conversation ref → 节点', () => {
  it('节点字段：id 前缀 / entityKind / title 取会话标题 / conversation 元数据最小字段集', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-a' }], NODES, [], [], SESSIONS)
    expect(nodes).toHaveLength(1)
    const node = nodes[0]
    expect(node.id).toBe('conversation:conv-a')
    expect(node.entityKind).toBe('conversation')
    expect(node.kind).toBe('context')
    expect(node.title).toBe('架构裁定记录')
    expect(node.subtitle).toBe('21 条消息')
    expect(node.conversation?.id).toBe('conv-a')
    expect(node.conversation?.title).toBe('架构裁定记录')
    expect(node.conversation?.messageCount).toBe(21)
  })

  it('确定性位置：沿既有节点包围盒右侧外扩一列（数值钉死：右缘 620+96=716，顶 80）', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-a' }], NODES, [], [], SESSIONS)
    expect(nodes[0].x).toBe(716)
    expect(nodes[0].y).toBe(80)
  })

  it('同输入两次调用 → 同位置（确定性：无随机源、无 Date.now 依赖）', () => {
    const first = materializeProjectEntityNodes(CONVERSATION_REFS, NODES, [], [], SESSIONS)
    const second = materializeProjectEntityNodes(CONVERSATION_REFS, NODES, [], [], SESSIONS)
    expect(first.map((node) => [node.id, node.x, node.y])).toEqual(second.map((node) => [node.id, node.x, node.y]))
  })

  it('不同 id 不同位置：按 id 排序派生，固定行距 170', () => {
    const nodes = materializeProjectEntityNodes(CONVERSATION_REFS, NODES, [], [], SESSIONS)
    const byId = new Map(nodes.map((node) => [node.id, node]))
    // 排序后 conv-a 槽 0、conv-b 槽 1：同列不同行。
    expect(byId.get('conversation:conv-a')?.y).toBe(80)
    expect(byId.get('conversation:conv-b')?.y).toBe(80 + 170)
    expect(byId.get('conversation:conv-a')?.x).toBe(byId.get('conversation:conv-b')?.x)
    expect(byId.get('conversation:conv-a')?.y).not.toBe(byId.get('conversation:conv-b')?.y)
  })

  it('位置与 refs 传入顺序无关（槽位按 id 排序派生，不随 refs 顺序漂移）', () => {
    const ordered = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-a' }, { type: 'conversation', id: 'conv-b' }], NODES, [], [], SESSIONS)
    const reversed = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-b' }, { type: 'conversation', id: 'conv-a' }], NODES, [], [], SESSIONS)
    expect(ordered.map((node) => [node.id, node.x, node.y]).sort()).toEqual(reversed.map((node) => [node.id, node.x, node.y]).sort())
  })

  it('空画布 → 固定锚点（480, 360）', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-a' }], [], [], [], SESSIONS)
    expect(nodes[0].x).toBe(480)
    expect(nodes[0].y).toBe(360)
  })

  it('会话缺失 → 不产节点（不虚构投影）', () => {
    expect(materializeProjectEntityNodes([{ type: 'conversation', id: 'conv-missing' }], NODES, [], [], SESSIONS)).toEqual([])
  })

  it('既有类型不受影响：view ref 仍回原节点（向后兼容）', () => {
    const nodes = materializeProjectEntityNodes([{ type: 'view', id: 'view-a' }], NODES, [], [], SESSIONS)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('view-a')
    expect(nodes[0].entityKind).toBeUndefined()
  })
})

describe('semanticRefsForSourceIds：conversation 回环', () => {
  it("conversation:<id> 前缀 → conversation entityRef（不落 viewIds）", () => {
    const result = semanticRefsForSourceIds(['conversation:conv-a', 'view-a'], NODES)
    expect(result.entityRefs).toContainEqual({ type: 'conversation', id: 'conv-a' })
    expect(result.viewIds).toEqual(['view-a'])
  })

  it('节点表里的 conversation 投影节点（entityKind conversation）也走前缀分支，不误判为 scope/view', () => {
    const conversationNode: CanvasNode = {
      id: 'conversation:conv-a',
      kind: 'context',
      entityKind: 'conversation',
      title: '架构裁定记录',
      subtitle: '',
      x: 480,
      y: 360,
      width: 148,
      height: 92,
      conversation: { id: 'conv-a', title: '架构裁定记录' },
    }
    const result = semanticRefsForSourceIds(['conversation:conv-a'], [conversationNode])
    expect(result.entityRefs).toEqual([{ type: 'conversation', id: 'conv-a' }])
    expect(result.viewIds).toEqual([])
  })
})
