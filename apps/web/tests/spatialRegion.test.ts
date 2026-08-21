import { describe, expect, it } from 'vitest'
import { spatialRegionFromSelection } from '../src/state/spatialRegion'
import type { CanvasNode } from '../src/model'

const node = (id: string, x: number, y: number): CanvasNode => ({
  id, kind: 'source', title: id, subtitle: '', x, y, width: 100, height: 80, displayMode: 'standard',
})

describe('Spatial Region draft', () => {
  it('is derived from selected views without creating membership truth', () => {
    const region = spatialRegionFromSelection('region:1', ['a', 'b'], [node('a', 10, 20), node('b', 210, 120)], 10)
    expect(region?.memberViewIds).toEqual(['a', 'b'])
    expect(region?.bounds).toEqual({ x: 0, y: 10, width: 320, height: 200 })
  })
})
