/**
 * LCOS Glyth 状态目录 + 共享时钟/指针基础设施。
 *
 * 旧的"液态胶囊 + 四角弧壳"姿态系统已由 bloub 引擎（./bloub/，x.ai Grok bot
 * 头像复刻）取代，映射与注视适配见 ./glythBloub.ts。本文件只保留与渲染解耦的
 * 公共契约：
 * - 七个语义态（冻结）与 legacy 状态收敛（coerceGlythState）；
 * - 全局共享的 rAF 时钟：N 个 Glyth 实例只装一个循环（subscribeGlythClock）；
 * - 全局共享的指针位置追踪：N 个实例只装一个 window 监听（getPointerPosition）。
 */

export type LcosGlythState = 'stable' | 'working' | 'waiting' | 'error' | 'confirm' | 'absorb' | 'output'
export type LcosGlythVariant = 'balanced' | 'cursor' | 'soft'

export const GLYTH_STATES: readonly LcosGlythState[] = ['stable', 'working', 'waiting', 'error', 'confirm', 'absorb', 'output']

/** Legacy states map onto the frozen seven on load; the mapping is never written back. */
export function coerceGlythState(raw: string): LcosGlythState {
  if ((GLYTH_STATES as readonly string[]).includes(raw)) return raw as LcosGlythState
  if (raw === 'focus' || raw === 'candidate') return 'working'
  if (raw === 'blocked') return 'error'
  return 'stable'
}

type ClockSubscriber = (seconds: number) => void
const subscribers = new Set<ClockSubscriber>()
let animationFrame = 0
let lastFrame = 0

function tick(now: number) {
  animationFrame = requestAnimationFrame(tick)
  if (document.visibilityState !== 'visible' || now - lastFrame < 32) return
  lastFrame = now
  const seconds = now / 1000
  subscribers.forEach((subscriber) => subscriber(seconds))
}

export function subscribeGlythClock(subscriber: ClockSubscriber): () => void {
  subscribers.add(subscriber)
  if (!animationFrame) animationFrame = requestAnimationFrame(tick)
  return () => {
    subscribers.delete(subscriber)
    if (!subscribers.size && animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; lastFrame = 0 }
  }
}

/** One shared pointer tracker: N glyth instances never install N window listeners. */
export interface PointerPosition { readonly x: number; readonly y: number }

const pointerListeners = new Set<(position: PointerPosition) => void>()
let pointerPosition: PointerPosition | null = null
let pointerListenerAttached = false

function handlePointerMove(event: PointerEvent) {
  pointerPosition = { x: event.clientX, y: event.clientY }
  pointerListeners.forEach((listener) => listener(pointerPosition as PointerPosition))
}

export function subscribePointerPosition(listener: (position: PointerPosition) => void): () => void {
  if (!pointerListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    pointerListenerAttached = true
  }
  pointerListeners.add(listener)
  return () => {
    pointerListeners.delete(listener)
    if (!pointerListeners.size && pointerListenerAttached && typeof window !== 'undefined') {
      window.removeEventListener('pointermove', handlePointerMove)
      pointerListenerAttached = false
    }
  }
}

/** Null until the pointer actually moves: a cold UI must not stare at the top-left corner. */
export function getPointerPosition(): PointerPosition | null { return pointerPosition }
