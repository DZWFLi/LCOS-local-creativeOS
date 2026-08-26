/**
 * LcosIconButton —— LCOS 唯一图标按钮原语（Wave A0-2，Donor Map A5 收敛件）。
 *
 * 容器为有机形状（正圆 / 胶囊，不用矩形圆角）——游戏 GUI 裁决 §1 病灶⑥
 * 「图标太混乱太矩形化」→「有机形状图标容器」。
 * 视觉冻结：40×40 最小点击区（sm 视觉 32×32，命中区由 CSS 扩到 40×40）·
 * 按压 opacity .4 / 100ms（无阴影无缩放）· disabled 用 label-tertiary 色。
 *
 * 使用示例：
 *   import { LcosIconButton } from './LcosIconButton'
 *
 *   <LcosIconButton aria-label="关闭" onClick={onClose}><X size={16} /></LcosIconButton>
 *   <LcosIconButton shape="capsule" size="sm"><Plus size={14} />新建节点</LcosIconButton>
 */
import type { ComponentPropsWithRef } from 'react'

export interface LcosIconButtonProps extends ComponentPropsWithRef<'button'> {
  /** 容器形状：circle=正圆（默认）· capsule=胶囊（图标+文字组合时用） */
  shape?: 'circle' | 'capsule'
  /** sm 视觉 32×32（点击区扩到 40×40）· md 40×40（默认） */
  size?: 'sm' | 'md'
}

export function LcosIconButton({ shape = 'circle', size = 'md', type = 'button', className, ...rest }: LcosIconButtonProps) {
  const classes = ['lcos-icon-btn', `lcos-icon-btn--${shape}`, `lcos-icon-btn--${size}`, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
