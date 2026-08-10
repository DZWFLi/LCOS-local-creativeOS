import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { layoutContextTrail, layoutManualSpatial, layoutWorkflowGraph, surfaceLayoutToSpatial } from '../src/features/surfaces/surfaceLayouts'

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


  it('seeds Workflow from existing relative spatial memory instead of auto-ranking on mount', () => {
    const nodes = [{ ...node('left', '1'), x: 900, y: 600 }, { ...node('right', '2'), x: 1260, y: 740 }]
    const spatial = layoutManualSpatial(nodes, [{ id: 'rel', from: 'left', to: 'right', kind: 'reference' }])
    const positions = new Map(spatial.items.map((item) => [item.node.id, item]))
    expect(positions.get('left')).toMatchObject({ x: 120, y: 120 })
    expect(positions.get('right')!.x - positions.get('left')!.x).toBe(360)
    expect(positions.get('right')!.y - positions.get('left')!.y).toBe(140)
  })

  it('adapts legacy percentage heuristics into shared world-space geometry without mutating nodes', () => {
    const source = node('a', '1')
    const spatial = surfaceLayoutToSpatial({ items: [{ node: source, left: 50, top: 50, width: 20 }], edges: [] }, 1200, 760)
    expect(spatial.items[0]).toMatchObject({ node: source, x: 480, y: 353, width: 240, height: 54 })
    expect(source.x).toBe(0)
    expect(source.y).toBe(0)
  })

})
