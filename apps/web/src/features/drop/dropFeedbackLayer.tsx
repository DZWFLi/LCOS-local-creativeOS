import { useEffect, useRef } from 'react'
import type { DropPhase } from './dropPhases'

export interface DropFeedbackLayerProps {
  /** 当前五阶段（Grammar §14，idle 时不渲染任何反馈）。 */
  readonly phase: DropPhase
  /** 命中/接近的 drop target（约束于 overlay 独立分层，可用它定位与做目标类切换）。 */
  readonly hitElement?: HTMLElement | null
  /** 极短 label（receptive 时）；默认「加入这里」，可选「作为参考」。 */
  readonly label?: string
}

/**
 * Semantic Drop 五阶段反馈层（Wave D-2）。
 *
 * tldraw hinting 协议：overlay 独立分层，与 shape body 解耦——本层只画
 * field（目标轮廓加粗态）/ light sweep（光扫）/ recoil（回弹）/ hint（极短
 * label），不做任何投放写库逻辑。Toast 退兜底（§15：世界自己说话）。
 *
 * SSE 安全：定位与目标类切换全在 client useEffect，renderToStaticMarkup 无副作用。
 */
export function DropFeedbackLayer({ phase, hitElement = null, label }: DropFeedbackLayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hitElement) return
    const el = hitElement
    el.classList.toggle('is-receiving', phase === 'approaching' || phase === 'receptive')
    el.classList.toggle('is-accepting', phase === 'accept')
    el.classList.toggle('is-committing', phase === 'commit' || phase === 'settle')
    return () => {
      el.classList.remove('is-receiving', 'is-accepting', 'is-committing')
    }
  }, [hitElement, phase])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !hitElement) return
    const rect = hitElement.getBoundingClientRect()
    host.style.left = `${rect.left}px`
    host.style.top = `${rect.top}px`
    host.style.width = `${rect.width}px`
    host.style.height = `${rect.height}px`
  }, [phase, hitElement])

  if (phase === 'idle') return null

  const showSweep = phase === 'accept' || phase === 'commit' || phase === 'settle'
  const showRecoil = phase === 'accept'
  const showLabel = phase === 'receptive'

  return (
    <div ref={hostRef} className={`lcos-drop-feedback phase-${phase}`} data-phase={phase} aria-hidden="true">
      <span className="lcos-drop-field" aria-hidden="true" />
      {showRecoil && <span className="lcos-drop-recoil" aria-hidden="true" />}
      {showSweep && <span className="lcos-drop-sweep" aria-hidden="true" />}
      {showLabel && <span className="lcos-drop-hint">{label ?? '加入这里'}</span>}
    </div>
  )
}