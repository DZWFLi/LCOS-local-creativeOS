/**
 * LcosTooltip —— LCOS 工具提示原语（Wave A0-1）：Base UI Tooltip 行为层 + 收边缘 HUD 规格。
 *
 * 纪律来源：
 * - 游戏裁决 §2.1：Non-diegetic（HUD）——收边缘、可消失、永远不遮世界；工具提示不做箭头；
 * - 交互冻结：120ms 延迟显示、瞬间隐藏（closeDelay 0 + ending 无过渡）；
 * - 文字三保底：提示文字永远落在玻璃底板上（材质与 popover 同源：blur(40px) saturate(1.8)）；
 * - Design Grammar §13：pointer leave / Esc / outside click 收口行为由 Base UI 统一提供。
 *
 * 最小使用示例（供后续接线参考，本文件不实际接线）：
 *   import { LcosTooltip } from './features/ui/LcosTooltip'
 *
 *   <LcosTooltip label="收起到 Dock" trigger={<span>⌘D</span>} />
 *   <LcosTooltip label="删除后不可恢复" trigger={<LcosIconButton icon={Trash}>删除</LcosIconButton>} />
 */
import type { ReactNode, RefObject } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import type { TooltipPositionerProps, TooltipRootChangeEventDetails } from '@base-ui/react/tooltip'
import './ui-primitives.css'

/** tooltip 停靠在锚点的哪一侧（透传 Base UI Positioner 的 side） */
export type LcosTooltipSide = NonNullable<TooltipPositionerProps['side']>
/** 沿对齐轴相对锚点的对齐方式（透传 Base UI Positioner 的 align） */
export type LcosTooltipAlign = NonNullable<TooltipPositionerProps['align']>
/**
 * open 变化详情（Base UI 透传）：
 * details.reason ∈ 'trigger-hover' | 'trigger-focus' | 'trigger-press' | 'outside-press'
 *   | 'escape-key' | 'disabled' | 'imperative-action' | 'none'；
 * details.cancel() 可取消 Base UI 对本次状态变更的处理。
 */
export type LcosTooltipChangeDetails = TooltipRootChangeEventDetails

export interface LcosTooltipProps {
  /** 工具提示文本（极简内容，渲染在玻璃底板上） */
  readonly label: ReactNode
  /** 被解释的目标内容（渲染为原生 button，外观见 .lcos-tooltip-trigger） */
  readonly trigger: ReactNode
  /** 受控 open；不传则非受控（配合 defaultOpen） */
  readonly open?: boolean
  /** 初始是否打开（仅非受控） */
  readonly defaultOpen?: boolean
  /** open 变化回调，签名与 Base UI 一致：(open, details)，details 含 reason 与 cancel() */
  readonly onOpenChange?: (open: boolean, details: LcosTooltipChangeDetails) => void
  /** 停靠侧（默认 'top'：贴边浮现，收边缘） */
  readonly side?: LcosTooltipSide
  /** 对齐方式（默认 'center'） */
  readonly align?: LcosTooltipAlign
  /** 与锚点的间距 px（默认 6） */
  readonly sideOffset?: number
  /** 显示延迟 ms（默认 120） */
  readonly delay?: number
  /** 隐藏延迟 ms（默认 0：瞬间隐藏） */
  readonly closeDelay?: number
  /** portal 挂载容器，默认 body */
  readonly container?: HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null
  /** 禁用工具提示（不再显示） */
  readonly disabled?: boolean
  /** 追加到 Popup（玻璃底板）的类名 */
  readonly className?: string
  /** 追加到触发器的类名 */
  readonly triggerClassName?: string
}

export function LcosTooltip({
  label,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  delay = 120,
  closeDelay = 0,
  container,
  disabled,
  className,
  triggerClassName,
}: LcosTooltipProps) {
  const triggerClass = ['lcos-tooltip-trigger', triggerClassName].filter(Boolean).join(' ')
  const popupClass = ['lcos-tooltip', className].filter(Boolean).join(' ')

  return (
    <Tooltip.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      disabled={disabled}
      disableHoverablePopup
    >
      <Tooltip.Trigger className={triggerClass} delay={delay} closeDelay={closeDelay}>
        {trigger}
      </Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner
          className="lcos-tooltip-positioner"
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          <Tooltip.Popup className={popupClass}>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
