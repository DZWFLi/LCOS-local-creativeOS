import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_SATELLITES,
  satellitePlacements,
} from '../ObjectOrbit'

/**
 * Wave B-6/C-3（Native Visual Gate 圆环重写）契约测试：Orbit = 动作卫星径向围绕锚点身体（Grammar S13）。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom / 无 Base UI Portal）——行为壳
 * （createPortal + window capture 监听）无法静态渲染，此处只测纯函数数值契约；
 * click-open 生命周期（pointer leave 保持、Esc/outside/action 收口）由浏览器 E2E 覆盖。
 */

const ANCHOR = { x: 100, y: 100, width: 148, height: 92 }

describe('satellitePlacements：径向布局（Grammar S13「围绕 object，不遮 body」）', () => {
  it('1 颗卫星 → 正上方 90°（cx, cy - radius）', () => {
    const [placement] = satellitePlacements(1, ANCHOR)
    const radius = Math.hypot(148, 92) / 2 + 23
    expect(placement.angleDeg).toBe(90)
    expect(placement.x).toBeCloseTo(100 + 74, 5)
    expect(placement.y).toBeCloseTo(100 + 46 - radius, 5)
  })

  it('2 颗卫星 → 正上 / 正下 90° / -90°（完整圆环均分）', () => {
    const placements = satellitePlacements(2, ANCHOR)
    expect(placements.map((p) => p.angleDeg)).toEqual([90, -90])
    expect(placements[0].x).toBeCloseTo(placements[1].x, 5)
  })

  it('3 颗卫星 → 90° / -30° / -150°（完整圆环均布）', () => {
    expect(satellitePlacements(3, ANCHOR).map((p) => p.angleDeg)).toEqual([90, -30, -150])
  })

  it('5 颗卫星 → 完整 360° 均分（S13 上限）', () => {
    const placements = satellitePlacements(5, ANCHOR)
    expect(placements).toHaveLength(5)
    expect(placements.map((p) => p.angleDeg)).toEqual([90, 18, -54, -126, -198])
  })

  it('超上限按 MAX_VISIBLE_SATELLITES 截断（防御；调用方按 S13 自律）', () => {
    expect(satellitePlacements(9, ANCHOR)).toHaveLength(MAX_VISIBLE_SATELLITES)
  })

  it('0 颗 → 空数组（idle 时零渲染——HUD 零侵入）', () => {
    expect(satellitePlacements(0, ANCHOR)).toEqual([])
  })

  it('半径随锚点尺寸增长（hypot/2 + gap，锚点自身大小不被遮挡）', () => {
    const small = satellitePlacements(1, { x: 0, y: 0, width: 40, height: 40 })[0]
    const large = satellitePlacements(1, { x: 0, y: 0, width: 400, height: 300 })[0]
    const radiusSmall = Math.hypot(40, 40) / 2 + 23
    const radiusLarge = Math.hypot(400, 300) / 2 + 23
    expect(small.y).toBeCloseTo(20 - radiusSmall, 5)
    expect(large.y).toBeCloseTo(150 - radiusLarge, 5)
  })

  it('同输入两次调用同结果（确定性：无随机源）', () => {
    expect(satellitePlacements(3, ANCHOR)).toEqual(satellitePlacements(3, ANCHOR))
  })
})

describe('Orbit 常量契约（Grammar S13 冻结值）', () => {
  it('一级卫星上限 = 5（3~5 取上界）', () => {
    expect(MAX_VISIBLE_SATELLITES).toBe(5)
  })
})