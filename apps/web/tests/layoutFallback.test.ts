import { describe, expect, it } from 'vitest'

import { layoutPreview, layoutPreviewSync } from '../src/features/layout/layoutService'
import type { LayoutRequest } from '../src/features/layout/layoutTypes'

const request: LayoutRequest = {
  strategy: 'layered',
  nodes: [
    { id: 'a', x: 0, y: 0, width: 100, height: 50 },
    { id: 'b', x: 200, y: 0, width: 100, height: 50 },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
  gap: 30,
}

describe('Layout fallback (Phase C C3)', () => {
  it('falls back to builtin when no external engine is registered', async () => {
    const result = await layoutPreview(request, {})
    expect(['builtin-layered', 'builtin-relational', 'manual']).toContain(result.engine)
    expect(result.positions).toHaveLength(2)
  })

  it('falls back to builtin when the external engine throws', async () => {
    const result = await layoutPreview(request, {
      layered: {
        id: 'elk',
        strategy: 'layered',
        async layout() { throw new Error('engine exploded') },
      },
    })
    expect(result.engine).not.toBe('elk')
    expect(result.positions).toHaveLength(2)
  })

  it('builtin sync path stays available offline', () => {
    const result = layoutPreviewSync(request)
    expect(result.positions).toHaveLength(2)
  })
})
