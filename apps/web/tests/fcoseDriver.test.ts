import { describe, expect, it } from 'vitest'

import { createFcoseLayoutEngine, fcoseOptions } from '../src/features/layout/fcoseLayoutAdapter'
import { cytoscapeFcoseDriver } from '../src/features/layout/cytoscapeFcoseDriver'
import type { LayoutRequest } from '../src/features/layout/layoutTypes'

const request = (nodeCount: number): LayoutRequest => ({
  strategy: 'relational',
  nodes: Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    x: index * 24,
    y: 12,
    width: 120,
    height: 48,
    pinned: index === 0,
  })),
  edges: Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) => ({
    id: `edge-${index}`,
    from: `node-${index}`,
    to: `node-${index + 1}`,
  })),
  gap: 28,
})

describe('cytoscapeFcoseDriver (Phase C)', () => {
  it('runs real fCoSE and preserves pinned fixed nodes', async () => {
    const engine = createFcoseLayoutEngine(await cytoscapeFcoseDriver())
    const result = await engine.layout(request(42))
    expect(result.positions).toHaveLength(42)
    expect(result.engine).toBe('fcose')
    const anchor = result.positions.find((position) => position.id === 'node-0')
    expect(anchor).toMatchObject({ x: 0, y: 12 })
  }, 20_000)

  it('keeps randomize:false and fixedNodeConstraint in options', () => {
    const options = fcoseOptions(request(4))
    expect(options.randomize).toBe(false)
    expect(options.fixedNodeConstraint).toEqual([{ nodeId: 'node-0', position: { x: 60, y: 36 } }])
  })
})
