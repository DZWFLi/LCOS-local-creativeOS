import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GLYTH_STATES,
  coerceGlythState,
  getPointerPosition,
  subscribeGlythClock,
  subscribePointerPosition,
} from '../src/features/spatial/visual/glythMotion'

/**
 * bloub 迁移后的 glythMotion 契约测试（旧"液态胶囊姿态系统"已由 bloub 引擎取代，
 * 本文件只剩状态目录 + 共享时钟/指针基础设施——测试只锁这些公共契约）。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom），window/rAF/document 用 stub 全局。
 */

const rafTimers = new Set<ReturnType<typeof setTimeout>>()
const stubBrowserGlobals = () => {
  // rAF 用 16ms 定时器模拟（帧号用定时器 id；cancel 对应清除）
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
    const id = setTimeout(() => { rafTimers.delete(id); cb(Date.now()) }, 16)
    rafTimers.add(id)
    return id as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
    rafTimers.delete(id as unknown as ReturnType<typeof setTimeout>)
  })
  vi.stubGlobal('document', { visibilityState: 'visible' })
  // EventTarget 充当 window：addEventListener/removeEventListener/dispatchEvent 三件套天然可用
  vi.stubGlobal('window', new EventTarget())
}
const dispatchPointerMove = (x: number, y: number) => {
  const event = Object.assign(new Event('pointermove'), { clientX: x, clientY: y })
  ;(globalThis as unknown as { window: EventTarget }).window.dispatchEvent(event)
}

beforeEach(() => { stubBrowserGlobals() })
afterEach(() => { vi.unstubAllGlobals(); rafTimers.forEach((id) => clearTimeout(id)); rafTimers.clear() })

describe('Glyth 状态目录（七态冻结）', () => {
  it('GLYTH_STATES 恰好七个语义态（稳定/工作/等待/错误/确认/吸收/产出）', () => {
    expect(GLYTH_STATES).toEqual(['stable', 'working', 'waiting', 'error', 'confirm', 'absorb', 'output'])
  })

  it('七个冻结态原样通过 coerceGlythState', () => {
    for (const state of GLYTH_STATES) {
      expect(coerceGlythState(state)).toBe(state)
    }
  })

  it('legacy 态映射：focus/candidate → working、blocked → error（只读收敛，不回写）', () => {
    expect(coerceGlythState('focus')).toBe('working')
    expect(coerceGlythState('candidate')).toBe('working')
    expect(coerceGlythState('blocked')).toBe('error')
  })

  it('未知/垃圾输入 → stable 兜底（不抛错，渲染层永远拿到合法态）', () => {
    expect(coerceGlythState('unknown-state')).toBe('stable')
    expect(coerceGlythState('')).toBe('stable')
    expect(coerceGlythState('STABLE')).toBe('stable') // 大小写敏感：不合法就兜底
  })
})

describe('共享 rAF 时钟（N 个 Glyth 实例只装一个循环）', () => {
  it('订阅后回调收到秒值；退订后不再收到', async () => {
    let frames = 0
    const received: number[] = []
    const unsubscribe = subscribeGlythClock((seconds) => { frames += 1; received.push(seconds) })
    await new Promise((resolve) => setTimeout(resolve, 120))
    unsubscribe()
    const framesAtUnsub = frames
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(framesAtUnsub).toBeGreaterThan(0)
    expect(frames).toBe(framesAtUnsub) // 退订后不再增长
    expect(received.length).toBe(framesAtUnsub)
    expect(received[0]).toBeGreaterThan(0) // 秒值（now/1000）
  })

  it('多订阅者共享同一循环：两个回调几乎同帧计数', async () => {
    let a = 0
    let b = 0
    const un1 = subscribeGlythClock(() => { a += 1 })
    const un2 = subscribeGlythClock(() => { b += 1 })
    await new Promise((resolve) => setTimeout(resolve, 120))
    un1()
    un2()
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1) // 同一循环驱动，至多差一帧
  })

  it('退订幂等；全部退订后再启循环仍工作', async () => {
    const unsubscribe = subscribeGlythClock(() => {})
    unsubscribe()
    expect(() => unsubscribe()).not.toThrow()
    let called = false
    const un = subscribeGlythClock(() => { called = true })
    await new Promise((resolve) => setTimeout(resolve, 120))
    un()
    expect(called).toBe(true)
  })
})

describe('共享指针追踪（N 个实例只装一个 window 监听）', () => {
  it('pointermove 事件后：订阅者收到坐标、getPointerPosition 返回最新值', () => {
    const seen: Array<{ x: number; y: number }> = []
    const unsubscribe = subscribePointerPosition((position) => seen.push({ x: position.x, y: position.y }))
    dispatchPointerMove(120, 80)
    expect(seen).toEqual([{ x: 120, y: 80 }])
    expect(getPointerPosition()).toEqual({ x: 120, y: 80 })
    unsubscribe()
  })

  it('退订后不再收到事件；二次退订幂等', () => {
    let calls = 0
    const unsubscribe = subscribePointerPosition(() => { calls += 1 })
    dispatchPointerMove(10, 10)
    const callsAtUnsub = calls
    expect(() => unsubscribe()).not.toThrow()
    dispatchPointerMove(20, 20)
    expect(calls).toBe(callsAtUnsub) // 退订后不增长
  })

  it('多订阅者各自收到同一次 pointermove', () => {
    let a = -1
    let b = -1
    const un1 = subscribePointerPosition((p) => { a = p.x })
    const un2 = subscribePointerPosition((p) => { b = p.x })
    dispatchPointerMove(77, 7)
    expect(a).toBe(77)
    expect(b).toBe(77)
    un1()
    un2()
  })

  it('全退订后监听器被卸载（再次订阅仍然工作——共享监听不泄漏）', () => {
    const probe: number[] = []
    const un = subscribePointerPosition((p) => probe.push(p.x))
    dispatchPointerMove(55, 5)
    un()
    expect(probe).toEqual([55])
    // 卸载后再装：新订阅者工作正常
    let late = -1
    const un2 = subscribePointerPosition((p) => { late = p.x })
    dispatchPointerMove(99, 9)
    expect(late).toBe(99)
    un2()
  })
})
