/**
 * LcosPopover —— LCOS 浮层原语（Wave A0-1）：Base UI Popover 行为层 + Apple 视觉规格。
 *
 * 纪律来源：
 * - Design Grammar §2.3：Popover 是「真的浮在世界上方的 UI」，玻璃底板是 Liquid Glass 主领地；
 * - Apple Popover 规格冻结值（全部落在 ui-primitives.css，违者返工）：
 *   圆角 13px · backdrop blur(40px) saturate(1.8) · light 背景 rgba(255,255,255,.72) / dark rgba(30,30,30,.78)
 *   边框 0.5px（light rgba(255,255,255,.3) / dark rgba(255,255,255,.15)）· 阴影 0 8px 24px rgba(0,0,0,.18)
 *   内边距 12px 16px · 宽 200/260/320 三档 · 高上限 60vh
 *   出场 scale .85→1 + opacity 280ms cubic-bezier(.34,1.56,.64,1)（transform-origin 在箭头侧）
 *   退场 scale→.92 + opacity 0 200ms ease-out
 * - 游戏裁决 §2.1（文字三保底）：popover 内容文字永远落在玻璃底板上。
 *
 * 最小使用示例（供后续接线参考，本文件不实际接线）：
 *   import { LcosPopover } from './features/ui/LcosPopover'
 *
 *   <LcosPopover
 *     trigger={<span>更多信息</span>}
 *     anchorSide="top"
 *     anchorAlign="center"
 *     width={260}
 *     onOpenChange={(open, details) => {
 *       // Design Grammar §13：outside click / Esc / trigger press 行为统一收口
 *       // 例：if (!open && details.reason === 'outside-press') { ... } —— 点外关闭
 *       // 例：if (!open && details.reason === 'escape-key') { ... } —— Esc 关闭
 *       // cancel 能力：details.cancel() 可阻止 Base UI 本次 open 状态变更
 *     }}
 *   >
 *     <p>浮在世界之上的内容，文字天然落在玻璃底板上。</p>
 *   </LcosPopover>
 */
import type { ReactNode, RefObject } from 'react'
import { Popover } from '@base-ui/react/popover'
import type { PopoverPositionerProps, PopoverRootChangeEventDetails } from '@base-ui/react/popover'
import './ui-primitives.css'

/** popup 停靠在锚点的哪一侧（透传 Base UI Positioner 的 side） */
export type LcosPopoverSide = NonNullable<PopoverPositionerProps['side']>
/** 沿对齐轴相对锚点的对齐方式（透传 Base UI Positioner 的 align） */
export type LcosPopoverAlign = NonNullable<PopoverPositionerProps['align']>
/** 宽度三档：200 / 260 / 320（Apple Popover 冻结规格） */
export type LcosPopoverWidth = 200 | 260 | 320
/**
 * open 变化详情（Base UI 透传）：
 * details.reason ∈ 'outside-press' | 'escape-key' | 'trigger-press' | 'trigger-hover'
 *   | 'trigger-focus' | 'focus-out' | 'close-press' | 'imperative-action' | 'none'；
 * details.cancel() 可取消 Base UI 对本次状态变更的处理。
 */
export type LcosPopoverChangeDetails = PopoverRootChangeEventDetails

export interface LcosPopoverProps {
  /** popover 内容，渲染在玻璃底板（Popup）内 */
  readonly children: ReactNode
  /** 触发器内容（渲染为原生 button，外观见 .lcos-popover-trigger，可用 triggerClassName 定制） */
  readonly trigger: ReactNode
  /** 受控 open；不传则非受控（配合 defaultOpen） */
  readonly open?: boolean
  /** 初始是否打开（仅非受控） */
  readonly defaultOpen?: boolean
  /** open 变化回调，签名与 Base UI 一致：(open, details)，details 含 reason 与 cancel() */
  readonly onOpenChange?: (open: boolean, details: LcosPopoverChangeDetails) => void
  /** 停靠侧（默认 'bottom'） */
  readonly anchorSide?: LcosPopoverSide
  /** 对齐方式（默认 'center'） */
  readonly anchorAlign?: LcosPopoverAlign
  /** 与锚点的间距 px（默认 4） */
  readonly sideOffset?: number
  /** 对齐轴上的额外偏移 px（默认 0） */
  readonly alignOffset?: number
  /** 宽度档位：200 | 260 | 320（默认 260）；高上限 60vh 冻结在 CSS */
  readonly width?: LcosPopoverWidth
  /** portal 挂载容器，默认 body */
  readonly container?: HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null
  /** hover 是否也能打开（默认 false：点击打开） */
  readonly openOnHover?: boolean
  /** openOnHover 场景下的显示延迟 ms（默认走 Base UI 的 300） */
  readonly hoverDelay?: number
  /** 追加到 Popup（玻璃底板）的类名 */
  readonly className?: string
  /** 追加到触发器的类名 */
  readonly triggerClassName?: string
}

export function LcosPopover({
  children,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  anchorSide = 'bottom',
  anchorAlign = 'center',
  sideOffset = 4,
  alignOffset = 0,
  width = 260,
  container,
  openOnHover = false,
  hoverDelay,
  className,
  triggerClassName,
}: LcosPopoverProps) {
  const triggerClass = ['lcos-popover-trigger', triggerClassName].filter(Boolean).join(' ')
  const popupClass = ['lcos-popover', 'lcos-popover-anim', className].filter(Boolean).join(' ')

  return (
    <Popover.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger className={triggerClass} openOnHover={openOnHover} delay={hoverDelay}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner
          className="lcos-popover-positioner"
          side={anchorSide}
          align={anchorAlign}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
        >
          <Popover.Popup className={popupClass} data-lcos-width={width}>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
