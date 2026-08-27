import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../../../model'
// 宿主模块 import 即触发 entity:conversation 注册（注册方向：CanvasNodeVisual → registry，单向）。
import '../CanvasNodeVisual'
import { NODE_CARD_REGISTRY, nodeCardKey, resolveNodeCard } from '../nodeCardRegistry'

/**
 * Wave C-2（批八）契约测试：entity:conversation 卡片注册与渲染。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom）——与 ObjectOrbit.test.tsx 同一先例，
 * 静态结构用 renderToStaticMarkup 断言（ConversationGlyth 初始帧是 SSR 安全的静态快照）。
 */

const CONVERSATION_NODE: CanvasNode = {
  id: 'conversation:conv-1',
  kind: 'context',
  entityKind: 'conversation',
  title: '需求讨论·第三轮',
  subtitle: '7 条消息',
  x: 480,
  y: 360,
  width: 180,
  height: 132,
  conversation: {
    id: 'conv-1',
    title: '需求讨论·第三轮',
    messageCount: 7,
    lastRunAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
}

function renderCard(node: CanvasNode = CONVERSATION_NODE): string {
  const Card = resolveNodeCard(node)
  if (!Card) throw new Error('entity:conversation card not registered')
  return renderToStaticMarkup(
    <Card node={node} density="standard" runId="" runStatus={null} pending={false} onDetails={() => {}} showDetails={false} />,
  )
}

describe('nodeCardRegistry：entity:conversation 注册（Wave C-2 批八）', () => {
  it("nodeCardKey 派生 'entity:conversation'（entityKind 优先于 fileType/default）", () => {
    expect(nodeCardKey(CONVERSATION_NODE)).toBe('entity:conversation')
  })

  it('注册表存在 entity:conversation 渲染器（宿主 CanvasNodeVisual import 即注册）', () => {
    expect(NODE_CARD_REGISTRY['entity:conversation']).toBeTypeOf('function')
    expect(resolveNodeCard(CONVERSATION_NODE)).toBeTypeOf('function')
  })

  it('既有 context 族四键不受影响（向后兼容）', () => {
    for (const key of ['entity:workflow', 'entity:workspace', 'entity:context', 'entity:collection']) {
      expect(NODE_CARD_REGISTRY[key]).toBeTypeOf('function')
    }
  })
})

describe('ConversationGlythObject 卡片渲染（node 环境 renderToStaticMarkup 先例）', () => {
  it('渲染 svg.lcos-conversation-glyth：Glyth 身体出现在卡片里（Grammar §8 角色身体，非徽章）', () => {
    const html = renderCard()
    expect(html).toMatch(/<svg[^>]*lcos-conversation-glyth/)
    expect(html).toContain('data-conversation-id="conv-1"')
  })

  it('活动度字段接线：lastRunAt 近期 → data-glyth-state="working"', () => {
    const html = renderCard()
    expect(html).toContain('data-glyth-state="working"')
  })

  it('卡片外壳复用既有 entity 卡类名体系（lcos-object / lcos-project-entity-object / tab / heading）', () => {
    const html = renderCard()
    expect(html).toContain('lcos-conversation-glyth-object')
    expect(html).toContain('lcos-object')
    expect(html).toContain('lcos-project-entity-tab')
    expect(html).toContain('lcos-project-entity-heading')
    expect(html).toContain('Conversation')
    expect(html).toContain('需求讨论·第三轮')
  })

  it('conversation 元数据缺失 → 回落 CollectionObject 兜底（与查表未命中同语义，非错误路径）', () => {
    const html = renderCard({ ...CONVERSATION_NODE, conversation: undefined })
    expect(html).not.toMatch(/<svg[^>]*lcos-conversation-glyth/)
    expect(html).toContain('lcos-collection-object')
  })
})
