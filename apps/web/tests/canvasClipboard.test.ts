import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { copyCanvasSelection, pasteCanvasNodes, pasteRelationTemplate } from '../src/state/canvasClipboard'

const nodes: CanvasNode[] = [
  { id: 'a', kind: 'source', title: 'A', subtitle: '', x: 100, y: 100, width: 196, height: 108 },
  { id: 'b', kind: 'working', title: 'B', subtitle: '', x: 360, y: 100, width: 264, height: 190 },
  { id: 'c', kind: 'generated', title: 'C', subtitle: '', x: 700, y: 100, width: 264, height: 190 },
]
const edges: CanvasEdge[] = [
  { id: 'ab', from: 'a', to: 'b', kind: 'reference' },
  { id: 'bc', from: 'b', to: 'c', kind: 'modify' },
]
let counter = 0
const makeId = (prefix: string) => `${prefix}-${counter += 1}`

describe('v0.5.3 internal canvas clipboard', () => {
  it('copies selected views and only relationships internal to that selection', () => {
    const payload = copyCanvasSelection(nodes, edges, ['a', 'b'], null, 'project-1')
    expect(payload?.kind).toBe('nodes')
    if (!payload || payload.kind !== 'nodes') return
    expect(payload.nodes.map((node) => node.id)).toEqual(['a', 'b'])
    expect(payload.edges.map((edge) => edge.id)).toEqual(['ab'])
  })

  it('pastes remapped views without duplicating the underlying artifact identity', () => {
    const payload = copyCanvasSelection(nodes, edges, ['a', 'b'], null, 'project-1')
    if (!payload || payload.kind !== 'nodes') throw new Error('missing payload')
    const result = pasteCanvasNodes(payload, nodes, { x: 520, y: 520 }, makeId)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.nodes[0].artifactId).toBe('a')
    expect(result.nodes[0].viewOf).toBe('a')
    expect(result.edges[0].from).toBe(result.nodes[0].id)
    expect(result.edges[0].to).toBe(result.nodes[1].id)
    expect(result.nodes.some((node) => node.x === nodes[0].x && node.y === nodes[0].y)).toBe(false)
  })

  it('copies a relation template and applies it only to two ordered selections', () => {
    const payload = copyCanvasSelection(nodes, edges, [], 'bc', 'project-1')
    expect(payload?.kind).toBe('relation')
    if (!payload || payload.kind !== 'relation') return
    expect(pasteRelationTemplate(payload, ['a'], edges, makeId)).toBeNull()
    const relation = pasteRelationTemplate(payload, ['a', 'c'], edges, makeId)
    expect(relation).toMatchObject({ from: 'a', to: 'c', kind: 'modify' })
  })
})
