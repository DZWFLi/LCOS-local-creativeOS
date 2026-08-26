/**
 * LcosButton —— LCOS 唯一按钮原语（Wave A0-2，Donor Map A5 收敛件）。
 *
 * 业务组件一律消费本组件，不再自建 button 样式（§14：不新增业务私有 button/input/popover）。
 * 视觉冻结（Apple 按钮规格）：radius 12px · 按压 opacity .4 / 100ms（无阴影无缩放）·
 * disabled 用 label-tertiary 色（不降 opacity）· 最小高 sm 32px / md 36px。
 *
 * 使用示例：
 *   import { LcosButton } from './LcosButton'
 *
 *   <LcosButton variant="primary" onClick={run}>运行</LcosButton>
 *   <LcosButton variant="secondary" size="sm" onClick={onCancel}>取消</LcosButton>
 *   <LcosButton variant="ghost">了解更多</LcosButton>
 *   <LcosButton variant="destructive" disabled={!selected}>删除</LcosButton>
 */
import type { ComponentPropsWithRef } from 'react'

export interface LcosButtonProps extends ComponentPropsWithRef<'button'> {
  /** primary=accent 蓝底白字 · secondary=label-primary 文字+fill-secondary 底 · ghost=纯 accent 文字 · destructive=红字 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  /** sm 最小高 32px · md 最小高 36px（默认 md） */
  size?: 'sm' | 'md'
}

export function LcosButton({ variant = 'primary', size = 'md', type = 'button', className, ...rest }: LcosButtonProps) {
  const classes = ['lcos-btn', `lcos-btn--${variant}`, `lcos-btn--${size}`, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
