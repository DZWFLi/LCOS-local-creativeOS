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
  it('未注册的键查表返回 undefined（调用方须回落到既有 switch 分支，非错误路径）', () => {
    expect(resolveNodeCard(nodeFixture({ entityKind: 'workflow' }))).toBeUndefined()
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

describe('NODE-CARD-REGISTRY 示范卡走表（entity:context → ContextProjectionObject）', () => {
  it('宿主模块加载后注册表含示范卡，查表命中同一渲染器', () => {
    const registered = NODE_CARD_REGISTRY['entity:context']
    expect(typeof registered).toBe('function')
    expect(resolveNodeCard(nodeFixture({ entityKind: 'context' }))).toBe(registered)
  })

  it('源码契约：分发处查表优先、miss 时 fallback 链保持既有分支（行为零变化）', () => {
    expect(nodeVisualSource).toContain('resolveNodeCard(props.node)')
    expect(nodeVisualSource).toContain(`registerNodeCard('entity:context', ContextProjectionObject)`)
    // fallback 链四分支原样保留：registry 为空时行为与平移前一致。
    for (const branch of ['workflow', 'workspace', 'context'] as const) {
      expect(nodeVisualSource).toContain(`props.node.entityKind === '${branch}'`)
    }
    expect(nodeVisualSource).toContain('return <CollectionObject {...props} />')
  })
})
