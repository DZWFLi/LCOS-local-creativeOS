import { describe, expect, it } from 'vitest'
import { MAX_VISIBLE_SATELLITES, satellitePlacements } from '../ObjectOrbit'

const ANCHOR = { x: 100, y: 100, width: 148, height: 92 }

describe('A22 Action Arc：右上角贴角短弧', () => {
  it('不再以对象中心为圆心：所有落点都聚集在 visual top-right corner 周围', () => {
    const placements = satellitePlacements(4, ANCHOR)
    const right = ANCHOR.x + ANCHOR.width
    const top = ANCHOR.y
    expect(placements).toHaveLength(4)
    placements.forEach((placement) => {
      expect(Math.abs(placement.x - right)).toBeLessThanOrEqual(46)
      expect(Math.abs(placement.y - top)).toBeLessThanOrEqual(36)
    })
  })

  it('3 个动作形成上缘→角部→右侧的视觉括弧，而不是完整 360° 均分', () => {
    const placements = satellitePlacements(3, ANCHOR)
    const right = ANCHOR.x + ANCHOR.width
    const top = ANCHOR.y
    expect(placements[0].x).toBeLessThan(right)
    expect(placements[0].y).toBeLessThan(top)
    expect(placements[1].y).toBeLessThan(placements[0].y)
    expect(placements[2].x).toBeGreaterThan(right)
    expect(placements[2].y).toBeGreaterThan(top)
  })

  it('4 个动作仍保持短弧，不为容纳动作扩大成大圆', () => {
    const placements = satellitePlacements(4, ANCHOR)
    const xs = placements.map((p) => p.x)
    const ys = placements.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(70)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(50)
  })

  it('1/2/3/4 个动作都有确定性模板', () => {
    for (const count of [1, 2, 3, 4]) {
      expect(satellitePlacements(count, ANCHOR)).toEqual(satellitePlacements(count, ANCHOR))
      expect(satellitePlacements(count, ANCHOR)).toHaveLength(count)
    }
  })

  it('超过上限按 4 个截断；overflow 必须交给 More / Context Menu', () => {
    expect(MAX_VISIBLE_SATELLITES).toBe(4)
    expect(satellitePlacements(9, ANCHOR)).toHaveLength(4)
  })

  it('0 个动作不渲染', () => {
    expect(satellitePlacements(0, ANCHOR)).toEqual([])
  })
})
