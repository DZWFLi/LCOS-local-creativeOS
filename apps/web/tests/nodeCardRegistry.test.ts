import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { CanvasNode } from '../src/model'
// 引入宿主模块触发示范卡注册（仅模块副作用，不渲染任何组件）。
import '../src/features/canvas/CanvasNodeVisual'
import { NODE_CARD_REGISTRY, nodeCardKey, registerNodeCard, resolveNodeCard } from '../src/features/canvas/nodeCardRegistry'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const nodeVisualSource = source('features/canvas/CanvasNodeVisual.tsx')

function nodeFixture(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return { id: 'n1', kind: 'source', title: 'a.md', subtitle: '', x: 0, y: 0, width: 100, height: 80, ...overrides }
}

describe('NODE-CARD-REGISTRY 组合键派生（nodeCardKey）', () => {
  it('entityKind 优先：collection/context/workflow/workspace 四类各自成键', () => {
    expect(nodeCardKey(nodeFixture({ entityKind: 'collection' }))).toBe('entity:collection')
    expect(nodeCardKey(nodeFixture({ entityKind: 'context' }))).toBe('entity:context')
    expect(nodeCardKey(nodeFixture({ entityKind: 'workflow' }))).toBe('entity:workflow')
    expect(nodeCardKey(nodeFixture({ entityKind: 'workspace' }))).toBe('entity:workspace')
  })

  it('无 entityKind 时退到 fileType（小写归一），两者皆无落 default', () => {
    expect(nodeCardKey(nodeFixture({ fileType: 'PDF' }))).toBe('file:pdf')
    expect(nodeKey({ fileType: 'image' })).toBe('file:image')
    expect(nodeKey({})).toBe('default')
  })

  it('entityKind 存在时 fileType 不参与组合键（优先级契约）', () => {
    expect(nodeKey({ entityKind: 'context', fileType: 'pdf' })).toBe('entity:context')
  })
})

function nodeKey(overrides: Partial<CanvasNode>): string {
  return nodeCardKey(nodeFixture(overrides))
}

describe('NODE-CARD-REGISTRY fallback 语义', () => {
  it('未注册的键查表返回 undefined（调用方须回落 CollectionObject 兜底，非错误路径）', () => {
    expect(resolveNodeCard(nodeFixture({ fileType: 'pdf' }))).toBeUndefined()
    expect(resolveNodeCard(nodeFixture())).toBeUndefined()
  })

  it('registerNodeCard 可注册新卡且后写覆盖先写（扩卡不改分发逻辑）', () => {
    const first = () => null
    const second = () => null
    registerNodeCard('file:pdf', first as never)
    expect(NODE_CARD_REGISTRY['file:pdf']).toBe(first)
    registerNodeCard('file:pdf', second as never)
    expect(NODE_CARD_REGISTRY['file:pdf']).toBe(second)
    delete NODE_CARD_REGISTRY['file:pdf']
    expect(resolveNodeCard(nodeFixture({ fileType: 'pdf' }))).toBeUndefined()
  })
})

describe('NODE-CARD-REGISTRY context 族全量入表（20260826 做实）', () => {
  it('宿主模块加载后四类 entityKind 卡全部注册，查表命中注册项', () => {
    for (const kind of ['workflow', 'workspace', 'context', 'collection'] as const) {
      const registered = NODE_CARD_REGISTRY[`entity:${kind}`]
      expect(typeof registered).toBe('function')
      expect(resolveNodeCard(nodeFixture({ entityKind: kind }))).toBe(registered)
    }
  })

  it('源码契约：四卡注册在表；分发处查表即走，唯一 fallback 是 CollectionObject 兜底', () => {
    expect(nodeVisualSource).toContain('resolveNodeCard(props.node)')
    for (const kind of ['workflow', 'workspace', 'context', 'collection'] as const) {
      expect(nodeVisualSource).toContain(`registerNodeCard('entity:${kind}'`)
    }
    // entityKind switch 分支已删（20260826 做实）：查表未命中只剩 CollectionObject 兜底。
    for (const branch of ['workflow', 'workspace', 'context'] as const) {
      expect(nodeVisualSource).not.toContain(`props.node.entityKind === '${branch}'`)
    }
    expect(nodeVisualSource).toContain('return <CollectionObject {...props} />')
  })
})
