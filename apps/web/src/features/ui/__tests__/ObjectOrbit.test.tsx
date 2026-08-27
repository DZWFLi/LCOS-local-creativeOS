import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_SATELLITES,
  POINTER_LEAVE_CLOSE_DELAY_MS,
  satellitePlacements,
} from '../ObjectOrbit'

/**
 * Wave B-6/C-3（批十四径向重写）契约测试：Orbit = 动作卫星径向围绕锚点身体（Grammar S13）。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom / 无 Base UI Portal）——行为壳
 * （createPortal + window capture 监听）无法静态渲染，此处只测纯函数数值契约；
 * 行为统一（Esc/outside/leave）由 overlayStack 契约测试与浏览器活体覆盖。
 */

const ANCHOR = { x: 100, y: 100, width: 148, height: 92 }

describe('satellitePlacements：径向布局（Grammar S13「围绕 object，不遮 body」）', () => {
  it('1 颗卫星 → 正上方 90°（cx, cy - radius）', () => {
    const [placement] = satellitePlacements(1, ANCHOR)
    const radius = Math.hypot(148, 92) / 2 + 36
    expect(placement.angleDeg).toBe(90)
    expect(placement.x).toBeCloseTo(100 + 74, 5)
    expect(placement.y).toBeCloseTo(100 + 46 - radius, 5)
  })

  it('2 颗卫星 → 上半圆均分 135° / 45°（左右对称）', () => {
    const placements = satellitePlacements(2, ANCHOR)
    expect(placements.map((p) => p.angleDeg)).toEqual([135, 45])
    expect(placements[0].x).toBeCloseTo(ANCHOR.x + 74 - Math.SQRT2 / 2 * (Math.hypot(148, 92) / 2 + 36), 5)
    expect(placements[0].y).toBeCloseTo(placements[1].y, 5)
  })

  it('3 颗卫星 → 150° / 90° / 30°（均布上半圆）', () => {
    expect(satellitePlacements(3, ANCHOR).map((p) => p.angleDeg)).toEqual([150, 90, 30])
  })

  it('5 颗卫星 → 180°→0° 均分（S13 上限）', () => {
    const placements = satellitePlacements(5, ANCHOR)
    expect(placements).toHaveLength(5)
    expect(placements.map((p) => p.angleDeg)).toEqual([162, 126, 90, 54, 18])
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
    const radiusSmall = Math.hypot(40, 40) / 2 + 36
    const radiusLarge = Math.hypot(400, 300) / 2 + 36
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

  it('pointer leave 容错 = 300ms（期间 re-enter 取消）', () => {
    expect(POINTER_LEAVE_CLOSE_DELAY_MS).toBe(300)
  })
})