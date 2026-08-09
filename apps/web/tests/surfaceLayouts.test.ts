import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { layoutContextTrail, layoutWorkflowGraph } from '../src/features/surfaces/surfaceLayouts'

const node = (id: string, createdAt: string, kind: CanvasNode['kind'] = 'source'): CanvasNode => ({ id, kind, title: id, subtitle: '', createdAt, x: 0, y: 0, width: 180, height: 100 })

describe('dedicated Context and Workflow layouts', () => {
  it('orders Context as a readable collaboration trail', () => {
    const layout = layoutContextTrail([node('later', '2026-02-02'), node('earlier', '2026-01-01')], [])
    expect(layout.items.map((item) => item.node.id)).toEqual(['earlier', 'later'])
    expect(layout.items[0]!.left).toBeLessThan(layout.items[1]!.left)
  })

  it('ranks Workflow left-to-right from existing relations', () => {
    const nodes = [node('input', '1'), node('run', '2', 'process'), node('output', '3', 'generated')]
    const edges: CanvasEdge[] = [{ id: '1', from: 'input', to: 'run', kind: 'generate' }, { id: '2', from: 'run', to: 'output', kind: 'generate' }]
    const layout = layoutWorkflowGraph(nodes, edges)
    const positions = new Map(layout.items.map((item) => [item.node.id, item.left]))
    expect(positions.get('input')!).toBeLessThan(positions.get('run')!)
    expect(positions.get('run')!).toBeLessThan(positions.get('output')!)
  })
})
