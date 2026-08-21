import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../src/model'
import { arrangeSelectedNodes } from '../src/features/canvas/selectionLayout'

const nodes: CanvasNode[] = [
  { id: 'source', kind: 'source', title: '来源', subtitle: '', x: 500, y: 420, width: 196, height: 108 },
  { id: 'working', kind: 'working', title: '当前', subtitle: '', x: 80, y: 80, width: 264, height: 190 },
  { id: 'generated', kind: 'generated', title: '结果', subtitle: '', x: 220, y: 360, width: 264, height: 190 },
  { id: 'run', kind: 'process', title: '执行', subtitle: '', x: 720, y: 40, width: 238, height: 82 },
  { id: 'untouched', kind: 'note', title: '不整理', subtitle: '', x: 900, y: 700, width: 218, height: 110 },
]

describe('v0.5.3 selected-node arrangement', () => {
  it('places source left, working center, output right and process below while preserving unselected nodes', () => {
    const arranged = arrangeSelectedNodes(nodes, ['source', 'working', 'generated', 'run'])
    const source = arranged.find((node) => node.id === 'source')!
    const working = arranged.find((node) => node.id === 'working')!
    const generated = arranged.find((node) => node.id === 'generated')!
    const run = arranged.find((node) => node.id === 'run')!
    const untouched = arranged.find((node) => node.id === 'untouched')!
    expect(source.x).toBeLessThan(working.x)
    expect(working.x).toBeLessThan(generated.x)
    expect(run.y).toBeGreaterThan(Math.max(source.y + source.height, working.y + working.height, generated.y + generated.height))
    expect(untouched).toEqual(nodes[4])
  })
})
