import type { CSSProperties } from 'react'

export interface LightCurtainProps {
  /** drop = 紫色投送光幕；delete = 红色删除光幕。 */
  tone: 'drop' | 'delete'
  /** 需要点亮的屏幕边缘。 */
  anchors: readonly ('left' | 'bottom')[]
  /** 指针已命中有效目标 / 删除区，光幕加强。 */
  hot?: boolean
  /** 可选标签（投送目标名 / 删除提示）。 */
  label?: string
  /** 可选数量徽标。 */
  count?: number
}

/**
 * 渐变光幕：纯视觉提醒层，不承载任何交互。
 * 与 R3 Direct Drop 的 ghost + 目标高亮并存，恢复旧版 edge-cue 的光效质感。
 */
export function LightCurtain({ tone, anchors, hot = false, label, count }: LightCurtainProps) {
  if (anchors.length === 0) return null
  return <div className={`lcos-light-curtain tone-${tone} ${hot ? 'is-hot' : ''}`} aria-hidden="true">
    {anchors.includes('left') && <span className="lcos-light-curtain-edge anchor-left"><i/></span>}
    {anchors.includes('bottom') && <span className="lcos-light-curtain-edge anchor-bottom"><i/></span>}
    {label && <span className="lcos-light-curtain-label" style={{ '--curtain-count': count ?? 0 } as CSSProperties}>
      {count ? <b>{count}</b> : null}
      <span>{label}</span>
    </span>}
  </div>
}
