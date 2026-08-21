import { describe, expect, it } from 'vitest'
import { chooseLayoutStrategy, chooseRelationFirstLayoutMode } from '../src/features/layout/layoutService'
import { layoutPreviewSync } from '../src/features/layout/layoutService'
import { measureLayoutQuality } from '../src/features/layout/layoutQuality'
import type { LayoutEdgeInput, LayoutNodeInput, LayoutPosition } from '../src/features/layout/layoutTypes'

const node = (id: string, x = 0, y = 0): LayoutNodeInput => ({ id, x, y, width: 120, height: 60 })
const edge = (id: string, from: string, to: string, kind: LayoutEdgeInput['kind'] = 'generate'): LayoutEdgeInput => ({ id, from, to, kind })

describe('Phase 2 — relation-first layout router', () => {
  it('routes clearly-directed graphs to elk-directed', () => {
    expect(chooseRelationFirstLayoutMode({ nodeCount: 4, edgeCount: 3, directedRatio: 1, hasHierarchy: false, userRequestedFree: false })).toBe('elk-directed')
    expect(chooseRelationFirstLayoutMode({ nodeCount: 4, edgeCount: 3, directedRatio: 0.67, hasHierarchy: false, userRequestedFree: false })).toBe('elk-directed')
    expect(chooseRelationFirstLayoutMode({ nodeCount: 4, edgeCount: 3, directedRatio: 0.5, hasHierarchy: true, userRequestedFree: false })).toBe('elk-directed')
  })

  it('routes reference-heavy graphs to fcose-relation', () => {
    expect(chooseRelationFirstLayoutMode({ nodeCount: 4, edgeCount: 5, directedRatio: 0.4, hasHierarchy: false, userRequestedFree: false })).toBe('fcose-relation')
  })

  it('keeps manual for free-form or edge-less requests', () => {
    expect(chooseRelationFirstLayoutMode({ nodeCount: 4, edgeCount: 3, directedRatio: 1, hasHierarchy: false, userRequestedFree: true })).toBe('manual')
    expect(chooseRelationFirstLayoutMode({ nodeCount: 3, edgeCount: 0, directedRatio: 0, hasHierarchy: false, userRequestedFree: false })).toBe('manual')
    expect(chooseRelationFirstLayoutMode({ nodeCount: 1, edgeCount: 1, directedRatio: 1, hasHierarchy: false, userRequestedFree: false })).toBe('manual')
  })

  it('feeds the arrange pipeline strategy chooser', () => {
    const nodes = [node('a'), node('b'), node('c')]
    expect(chooseLayoutStrategy({ nodes, edges: [edge('e1', 'a', 'b', 'generate'), edge('e2', 'b', 'c', 'generate')] })).toBe('layered')
    expect(chooseLayoutStrategy({ nodes, edges: [edge('e1', 'a', 'b', 'reference'), edge('e2', 'b', 'c', 'reference')] })).toBe('relational')
    expect(chooseLayoutStrategy({ nodes, edges: [] })).toBe('manual')
  })
})

describe('Phase 2 — layout quality metrics', () => {
  it('counts crossings, backward edges, length, overlap and pinned drift', () => {
    // a→b 与 c→d 两条交叉对角线；e 反向；f 与 a 重叠；pin 节点漂移。
    const nodes: LayoutNodeInput[] = [
      node('a', 0, 0), node('b', 300, 300), node('c', 0, 300), node('d', 300, 0),
      node('e', 400, 0), node('f', 10, 10), node('pin', 600, 600, ),
    ]
    nodes[6]!.pinned = true
    const edges: LayoutEdgeInput[] = [
      edge('ab', 'a', 'b', 'generate'), edge('cd', 'c', 'd', 'generate'),
      edge('ea', 'e', 'a', 'generate'), // 反向：目标在源左侧
      edge('af', 'a', 'f', 'reference'),
    ]
    const positions: LayoutPosition[] = [
      { id: 'a', x: 0, y: 0 }, { id: 'b', x: 300, y: 300 }, { id: 'c', x: 0, y: 300 }, { id: 'd', x: 300, y: 0 },
      { id: 'e', x: 400, y: 0 }, { id: 'f', x: 10, y: 10 }, { id: 'pin', x: 700, y: 700 },
    ]
    const quality = measureLayoutQuality({ nodes, edges, positions })
    expect(quality.edgeCrossings).toBe(1) // ab × cd 交叉；af 与其它共享端点
    expect(quality.backwardEdges).toBe(1)
    expect(quality.overlappingNodes).toBe(2) // a × f、d × e
    expect(quality.pinnedNodeDrift).toBeCloseTo(Math.hypot(100, 100), 6)
    expect(quality.totalEdgeLength).toBeGreaterThan(0)
  })

  it('reports clean layouts as zeroed metrics', () => {
    const nodes = [node('a', 0, 0), node('b', 300, 0), node('c', 600, 0)]
    const edges = [edge('ab', 'a', 'b', 'generate'), edge('bc', 'b', 'c', 'generate')]
    const positions: LayoutPosition[] = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 300, y: 0 }, { id: 'c', x: 600, y: 0 }]
    expect(measureLayoutQuality({ nodes, edges, positions })).toMatchObject({
      edgeCrossings: 0,
      backwardEdges: 0,
      overlappingNodes: 0,
      pinnedNodeDrift: 0,
    })
  })

  it('arranges a directed relation-first fixture with zero crossings, zero overlap and pinned drift (Phase 2 §5.4)', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 200), node('c', 0, 400), node('d', 0, 600)]
    nodes[0]!.pinned = true
    const edges = [edge('ab', 'a', 'b', 'generate'), edge('bc', 'b', 'c', 'generate'), edge('cd', 'c', 'd', 'generate')]
    const result = layoutPreviewSync({ nodes, edges, strategy: 'layered', preserveManualAnchors: true })
    const quality = measureLayoutQuality({ nodes, edges, positions: result.positions })
    expect(quality.edgeCrossings).toBe(0)
    expect(quality.overlappingNodes).toBe(0)
    expect(quality.pinnedNodeDrift).toBe(0)
    expect(result.movedIds.length).toBeGreaterThan(0)
  })
})
