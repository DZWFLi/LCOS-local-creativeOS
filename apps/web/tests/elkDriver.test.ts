import { describe, expect, it } from 'vitest'

import { elkDriver } from '../src/features/layout/elkDriver'
import { createElkLayoutEngine } from '../src/features/layout/elkLayoutAdapter'
import type { LayoutRequest } from '../src/features/layout/layoutTypes'

const request = (nodeCount: number): LayoutRequest => ({
  strategy: 'layered',
  nodes: Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    x: index * 20,
    y: 0,
    width: 120,
    height: 48,
    pinned: index === 0,
  })),
  edges: Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) => ({
    id: `edge-${index}`,
    from: `node-${index}`,
    to: `node-${index + 1}`,
  })),
  gap: 30,
})

describe('elkDriver (Phase C)', () => {
  it('loads real ELK and lays out 42 nodes with pinned anchor preserved', async () => {
    const engine = createElkLayoutEngine(await elkDriver())
    const result = await engine.layout(request(42))
    expect(result.positions).toHaveLength(42)
    expect(result.engine).toBe('elk')
    const anchor = result.positions.find((position) => position.id === 'node-0')
    expect(anchor).toMatchObject({ x: 0, y: 0 })
  }, 20_000)

  it('produces deterministic layered positions', async () => {
    const engine = createElkLayoutEngine(await elkDriver())
    const first = await engine.layout(request(10))
    const second = await engine.layout(request(10))
    expect(first.positions.map((position) => `${position.id}:${position.x}:${position.y}`).sort())
      .toEqual(second.positions.map((position) => `${position.id}:${position.x}:${position.y}`).sort())
  }, 20_000)
})
