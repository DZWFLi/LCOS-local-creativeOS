/**
 * ObjectOrbit —— 对象局部动作语言（Grammar S13）：动作卫星径向围绕锚点身体展开。
 *
 * 批十四重写（用户实机裁决：「哪来的 orbit，只有卡片弹窗」）：
 * - 旧版是 Base UI Popover 里竖排图鉴卡（四件套卡头 + 水平卫星行 + 卡尾）——
 *   卫星不围绕对象（S13「围绕 object」违例），卡头身份与画布上已有的身体+标注
 *   重复编码（S8.2 四通道不重复），用户看到的是「卡片」不是「orbit」。
 * - 新版只渲染动作卫星：从身体中心沿径向飞出到完整圆环落点，spring 逐个
 *   stagger 出场、反向收拢退场；无卡头无卡尾（身份长在画布身体上，弹层只
 *   承担动作——Object First，Card Last）。
 * - 行为统一（S13 原话：pointer leave / Esc / outside click 行为统一）：
 *   window capture 阶段监听（画布层 stopPropagation 不再截断，P0-B 教训），
 *   卫星与锚点身体同属 orbit 热区（leave 300ms 容错，期间 re-enter 取消）；
 *   动作执行即收口（transient orbit：单击即完成并消失）。
 * - overlayStack 注册 kind:'orbit'（A0-4 栈态一致性；Esc 链全局接线前的位置占位）。
 *
 * 径向布局（satellitePlacements 纯函数，测试数值钉死）：
 * - 锚点 = anchorRef 元素 getBoundingClientRect（无 DOM 锚时 anchorRect 虚拟锚）；
 * - 半径 = hypot(w,h)/2 + SATELLITE_RING_GAP；卫星围绕完整 360° 圆环均分。
 */
import { useCallback, useEffect, useId, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { register as registerOverlay } from './overlayStack'
import './ui-primitives.css'

/** Grammar S13：一级 satellite 上限（3~5 取上界；低频动作归右键菜单，调用方自律） */
export const MAX_VISIBLE_SATELLITES = 5
/** Grammar S13「pointer leave 行为统一」：离开 300ms 后关，期间 re-enter 取消 */
export const POINTER_LEAVE_CLOSE_DELAY_MS = 300
/** 卫星环半径 = 锚点半径 + 该间距（px） */
const SATELLITE_RING_GAP = 23
/** Grammar S13 编排区间（0.04~0.08s）取中：卫星逐个出场间隔 */
const SATELLITE_STAGGER = 0.06
/** 收场时长：与 LcosPopover 退场窗口同款（200ms） */
const SATELLITE_EXIT_DURATION = 0.2

/** 卫星动作（Grammar S11：只放最高频；低频勿塞入——归 context menu） */
export interface ObjectOrbitAction {
  readonly id: string
  readonly label: string
  readonly icon?: import('lucide-react').LucideIcon
  readonly onClick?: () => void
  /** primary 动作只做轻量强调，不改变顺序。 */
  readonly primary?: boolean
  /** readOnly 卫星只展示真实状态，不伪造可点击动作。 */
  readonly readOnly?: boolean
  /** Secondary expansion can replace the Orbit with another local layer. Default actions always close. */
  readonly keepOpen?: boolean
}

/** 视口坐标锚框（anchorRef 缺席时的虚拟锚，如画布空间坐标） */
export interface ObjectOrbitAnchorRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 径向落点（视口坐标 + 极角，测试数值断言用） */
export interface SatellitePlacement {
  readonly x: number
  readonly y: number
  readonly angleDeg: number
}

/**
 * 径向布局纯函数：从正上方 90° 起，沿完整 360° 圆环均分（屏幕坐标 y 向下）。
 * count 超 MAX_VISIBLE_SATELLITES 按上限截断（防御；调用方按 S13 自律只传高频动作）。
 */
export function satellitePlacements(
  count: number,
  anchor: ObjectOrbitAnchorRect,
  gap = SATELLITE_RING_GAP,
): readonly SatellitePlacement[] {
  const total = Math.max(0, Math.min(count, MAX_VISIBLE_SATELLITES))
  if (total === 0) return []
  const radius = Math.hypot(anchor.width, anchor.height) / 2 + gap
  const cx = anchor.x + anchor.width / 2
  const cy = anchor.y + anchor.height / 2
  return Array.from({ length: total }, (_, index) => {
    const angleDeg = 90 - index * (360 / total)
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
      angleDeg,
    }
  })
}

/** motion custom：出场从身体中心飞出（hidden = 中心位偏移），退场反向收拢 */
interface SatelliteCustom {
  readonly dx: number
  readonly dy: number
}

const ringVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: SATELLITE_STAGGER, delayChildren: 0.02 } },
  exiting: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
}

const satelliteVariants: Variants = {
  hidden: (custom: SatelliteCustom) => ({ opacity: 0, scale: 0.66, x: custom.dx, y: custom.dy }),
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exiting: (custom: SatelliteCustom) => ({
    opacity: 0,
    scale: 0.8,
    x: custom.dx * 0.35,
    y: custom.dy * 0.35,
    transition: { duration: SATELLITE_EXIT_DURATION, ease: 'easeOut' },
  }),
}

export interface ObjectOrbitProps {
  readonly open: boolean
  readonly onClose: () => void
  /** 锚点元素 ref（优先）：orbit 围绕它的包围盒径向展开 */
  readonly anchorRef?: RefObject<Element | null>
  readonly anchorRect?: ObjectOrbitAnchorRect | null
  /** 无障碍名称（如「会话 xx 的动作」；身份不在此渲染——身体在画布上） */
  readonly ariaLabel?: string
  readonly actions: readonly ObjectOrbitAction[]
}

/**
 * ObjectOrbit —— 行为壳：径向卫星 + Esc/outside/leave 统一收口。
 * 层与卫星只在 open 期间存在（HUD 零侵入）；卫星与锚点身体同属热区。
 */
export function ObjectOrbit({ open, onClose, anchorRef, anchorRect, ariaLabel, actions }: ObjectOrbitProps) {
  const layerRootRef = useRef<HTMLDivElement | null>(null)
  const leaveTimerRef = useRef<number | null>(null)
  const orbitId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const close = useCallback(() => {
    onCloseRef.current()
  }, [])

  const rect = anchorRef?.current?.getBoundingClientRect() ?? anchorRect ?? null
  const visible = actions.slice(0, MAX_VISIBLE_SATELLITES)
  const placements = rect === null
    ? []
    : satellitePlacements(visible.length, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
  const center = rect === null ? null : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const ringRadius = rect === null ? 0 : Math.hypot(rect.width, rect.height) / 2 + SATELLITE_RING_GAP

  /** overlayStack（A0-4）：kind 'orbit'，onEsc=close，dismissOnOutside=true（栈态一致性） */
  useEffect(() => {
    if (!open) return undefined
    const unregister = registerOverlay(orbitId, {
      kind: 'orbit',
      element: () => layerRootRef.current,
      onEsc: close,
      dismissOnOutside: true,
    })
    return unregister
  }, [open, orbitId, close])

  /** Esc（capture；S9.2 orbit 属第 1 层——「我现在不想待在这一层」） */
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, close])

  /** outside press（capture pointerdown；层内/锚点身体内不算外——P0-B 教训走 capture） */
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target !== null && layerRootRef.current?.contains(target) === true) return
      if (target !== null && anchorRef?.current?.contains(target) === true) return
      close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, close, anchorRef])

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const scheduleLeave = useCallback(() => {
    cancelLeave()
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null
      close()
    }, POINTER_LEAVE_CLOSE_DELAY_MS)
  }, [cancelLeave, close])

  /** 锚点身体也算 orbit 热区：enter 取消关场计时，leave 重新计时 */
  useEffect(() => {
    if (!open) return undefined
    const anchor = anchorRef?.current ?? null
    if (anchor === null) return undefined
    anchor.addEventListener('mouseenter', cancelLeave)
    anchor.addEventListener('mouseleave', scheduleLeave)
    return () => {
      anchor.removeEventListener('mouseenter', cancelLeave)
      anchor.removeEventListener('mouseleave', scheduleLeave)
    }
  }, [open, anchorRef, cancelLeave, scheduleLeave])

  useEffect(() => cancelLeave, [cancelLeave])
  useEffect(() => {
    if (!open) cancelLeave()
  }, [open, cancelLeave])

  /** 卫星执行：先动作后收口（transient orbit：单击即完成并消失） */
  const handleAction = useCallback(
    (action: ObjectOrbitAction) => {
      action.onClick?.()
      if (!action.keepOpen) close()
    },
    [close],
  )

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && center !== null && (
        <motion.div
          key="lcos-orbit-layer"
          ref={layerRootRef}
          className="lcos-orbit-layer"
          role="toolbar"
          aria-label={ariaLabel}
          initial="hidden"
          animate="visible"
          exit="exiting"
          variants={ringVariants}
        >
          <motion.span
            className="lcos-orbit-track"
            aria-hidden="true"
            style={{ left: center.x, top: center.y, width: ringRadius * 2, height: ringRadius * 2 }}
          />
          {visible.map((action, index) => {
            const placement = placements[index]
            if (placement === undefined) return null
            const custom: SatelliteCustom = { dx: center.x - placement.x, dy: center.y - placement.y }
            const ActionIcon = action.icon
            return (
              <motion.div
                key={action.id}
                className="lcos-orbit-sat"
                style={{ left: placement.x, top: placement.y }}
                custom={custom}
                variants={satelliteVariants}
              >
                {action.readOnly ? (
                  <span
                    className="lcos-orbit-satellite is-readonly"
                    data-lcos-orbit-action={action.id}
                    data-lcos-primary={action.primary === true ? 'true' : undefined}
                    data-lcos-readonly="true"
                    role="status"
                    aria-label={action.label}
                    onPointerEnter={cancelLeave}
                    onPointerLeave={scheduleLeave}
                  >
                    {ActionIcon !== undefined ? <ActionIcon size={16} aria-hidden="true" /> : null}
                    <span className="lcos-orbit-satellite-label">{action.label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="lcos-orbit-satellite"
                    data-lcos-orbit-action={action.id}
                    data-lcos-primary={action.primary === true ? 'true' : undefined}
                    onPointerEnter={cancelLeave}
                    onPointerLeave={scheduleLeave}
                    onClick={() => handleAction(action)}
                  >
                    {ActionIcon !== undefined ? <ActionIcon size={16} aria-hidden="true" /> : null}
                    <span className="lcos-orbit-satellite-label">{action.label}</span>
                  </button>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}