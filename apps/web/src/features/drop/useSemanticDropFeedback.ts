import { useCallback, useEffect, useRef, useState } from 'react'
import { advanceDropPhase } from './dropPhases'
import type { DropPhase, DropProximityInput } from './dropPhases'
import type { DropTargetHit } from '../spatial/semanticDrop'

/**
 * Accept 段停留时长：覆盖 accept 段 Light Sweep 220ms（ui-primitives.css 667 行）+ 收尾余量。
 */
export const DROP_ACCEPT_HOLD_MS = 230

/**
 * Commit 段停留时长：对齐 commit 段光扫 250ms + 30ms delay（ui-primitives.css 672-673 行）。
 */
export const DROP_COMMIT_HOLD_MS = 250 + 30

/**
 * Settle 段停留时长：对齐 settle-out 整体淡出 260ms（ui-primitives.css 695 行 --lcos-ui-slow）。
 */
export const DROP_SETTLE_OUT_MS = 260

/**
 * 五阶段反馈全长（accept 停留 + commit 停留 + settle 淡出）。
 * drop 命中后若动作会切换视图（如 capability:context 新建 Context），调用方应延迟到
 * 该时点再切换——否则主画布连反馈层一起被卸载，五阶段零呈现（Grammar S15：世界先说完话）。
 */
export const DROP_FEEDBACK_TOTAL_MS = DROP_ACCEPT_HOLD_MS + DROP_COMMIT_HOLD_MS + DROP_SETTLE_OUT_MS

/** 时间线推进用 proximity 输入：松手后空间判定不再参与（§15 短收尾由世界自己说话）。 */
const NO_PROXIMITY: DropProximityInput = { hitTarget: false, nearLegalTarget: false }

export interface SemanticDropFeedback {
  /** 当前五阶段（idle 时反馈层不渲染——HUD 零侵入）。 */
  readonly phase: DropPhase
  /** 当前锚定的 drop target 元素（approaching 无命中时沿用最近锚点）。 */
  readonly hitElement: HTMLElement | null
  /** 与 beginSemanticDrop 第四参 onPhase 兼容的回调（semantic drop 全生命周期直通）。 */
  readonly onPhase: (phase: DropPhase, hit: DropTargetHit | null) => void
}

/**
 * Semantic Drop 五阶段反馈接线 hook（Wave D-2 · Grammar §14/§15）。
 *
 * 持 phase + hitElement 两态；onPhase 直通 beginSemanticDrop 的 emitPhase：
 *   - approaching / receptive 逐帧跟随手势（tldraw：进行中每帧重算）；
 *   - 收到 'accept'（松手命中、onDrop 已触发）后自驱动 accept→commit→settle→idle
 *     时间线（target absorb → light sweep → short settle，不 toast），时长与
 *     ui-primitives.css 动画一一对应（禁散写魔数）；
 *   - 'idle' 即刻清空（tldraw：松手/取消清空），反馈层只在手势/短收尾期间存在。
 * 卸载时清全部 timer，反馈不残留。
 */
export function useSemanticDropFeedback(): SemanticDropFeedback {
  const [phase, setPhase] = useState<DropPhase>('idle')
  const [hitElement, setHitElement] = useState<HTMLElement | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const onPhase = useCallback((next: DropPhase, hit: DropTargetHit | null) => {
    clearTimers()
    if (next === 'accept') {
      setPhase('accept')
      setHitElement(hit?.element ?? null)
      const settleAt = DROP_ACCEPT_HOLD_MS + DROP_COMMIT_HOLD_MS
      const doneAt = settleAt + DROP_SETTLE_OUT_MS
      const advanceCommitted = () => setPhase((current) => advanceDropPhase(current, NO_PROXIMITY, true))
      timers.current = [
        window.setTimeout(advanceCommitted, DROP_ACCEPT_HOLD_MS),
        window.setTimeout(advanceCommitted, settleAt),
        window.setTimeout(() => {
          setPhase('idle')
          setHitElement(null)
        }, doneAt),
      ]
      return
    }
    if (next === 'idle') {
      setPhase('idle')
      setHitElement(null)
      return
    }
    setPhase(next)
    if (hit) setHitElement(hit.element)
  }, [clearTimers])

  return { phase, hitElement, onPhase }
}
