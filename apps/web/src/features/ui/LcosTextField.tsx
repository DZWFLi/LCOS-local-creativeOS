/**
 * LcosTextField —— LCOS 唯一文本输入原语（Wave A0-2，Donor Map A5 收敛件）。
 *
 * 视觉冻结（Apple 输入框规格）：背景 light #ffffff / dark #000000 ·
 * 描边 rgba(60,60,67,.29) / dark rgba(235,235,245,.3) · focus 描边 accent + ring 2px accent ·
 * 圆角 10px · 内 padding 8px 12px · disabled 用 label-tertiary 色（不降 opacity）。
 *
 * 使用示例：
 *   import { LcosTextField } from './LcosTextField'
 *
 *   <LcosTextField label="节点名称" value={name} placeholder="输入名称"
 *     onChange={(event) => setName(event.target.value)} />
 *   <LcosTextField aria-label="搜索" type="search" placeholder="搜索…" />
 */
import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export interface LcosTextFieldProps extends ComponentPropsWithRef<'input'> {
  /** 可选标签；渲染时自动与输入框做 id/htmlFor 无障碍关联 */
  label?: ReactNode
}

export function LcosTextField({ label, id, className, ...rest }: LcosTextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="lcos-field">
      {label ? <label className="lcos-field__label" htmlFor={inputId}>{label}</label> : null}
      <input id={inputId} className={['lcos-field__input', className].filter(Boolean).join(' ')} {...rest} />
    </div>
  )
}
