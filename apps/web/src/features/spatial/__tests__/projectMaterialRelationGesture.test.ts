import { describe, expect, it } from 'vitest'
import { RELATION_RECEPTOR_SCREEN_HALO_PX, relationReceptorScreenDistance } from '../projectMaterialRelationGesture'

const rect = { left: 100, top: 100, right: 220, bottom: 180, width: 120, height: 80 }

describe('Relation receptor screen-space halo', () => {
  it('freezes the L0 tolerance inside the 12–18px band', () => {
    expect(RELATION_RECEPTOR_SCREEN_HALO_PX).toBe(16)
    expect(RELATION_RECEPTOR_SCREEN_HALO_PX).toBeGreaterThanOrEqual(12)
    expect(RELATION_RECEPTOR_SCREEN_HALO_PX).toBeLessThanOrEqual(18)
  })

  it('measures body hits as zero and edge misses in screen pixels', () => {
    expect(relationReceptorScreenDistance(rect, 160, 140)).toBe(0)
    expect(relationReceptorScreenDistance(rect, 86, 140)).toBe(14)
    expect(relationReceptorScreenDistance(rect, 160, 196)).toBe(16)
  })

  it('uses radial distance at corners instead of a rectangular oversized catchment', () => {
    expect(relationReceptorScreenDistance(rect, 89, 89)).toBeCloseTo(Math.hypot(11, 11))
    expect(relationReceptorScreenDistance(rect, 87, 87)).toBeGreaterThan(RELATION_RECEPTOR_SCREEN_HALO_PX)
  })
})
