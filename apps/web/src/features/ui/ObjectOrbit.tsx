/**
 * ObjectOrbit —— 对象局部高频动作 owner。
 *
 * A22 GUI 裁决：Orbit 是语义 owner，不等于“必须画轨道”。
 * presentation 退役完整 360° 圆环，改为节点右上角外缘的短弧 Action Arc：
 * - 无可见轨道；
 * - 3 个为默认视觉量级，4 个为一级上限；
 * - 落点围绕 visual top-right corner，不占领对象四周；
 * - 落点使用手调视觉节奏而非等角/等距数学平均；
 * - click-open 生命周期、overlayStack / Esc / outside owner 保持不变。
 */
import { useCallback, useEffect, useId, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { queryStack, register as registerOverlay } from './overlayStack'
import './ui-primitives.css'

/** A22：一级 Action Arc 上限；更多动作必须进入 More / Context Menu。 */
export const MAX_VISIBLE_SATELLITES = 4
/** Action Arc 与 visual top-right corner 的屏幕空间基本间距。 */
const ACTION_ARC_GAP = 18
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

/** Action Arc 落点（视口坐标 + 可审计的视觉序号）。 */
export interface SatellitePlacement {
  readonly x: number
  readonly y: number
  readonly angleDeg: number
}

/**
 * A22 Action Arc：贴住对象 visual top-right corner 的短弧。
 *
 * 这里故意不用“完整圆 + 等角”。每个数量都有稳定的视觉模板：
 * 上缘靠右 → 绕过右上角 → 右侧上半段，正好对应用户手绘的红色括弧范围。
 * gap 只是整体外移量，不改变短弧节奏。
 */
export function satellitePlacements(
  count: number,
  anchor: ObjectOrbitAnchorRect,
  gap = ACTION_ARC_GAP,
): readonly SatellitePlacement[] {
  const total = Math.max(0, Math.min(count, MAX_VISIBLE_SATELLITES))
  if (total === 0) return []
  const cornerX = anchor.x + anchor.width
  const cornerY = anchor.y
  const templates: Record<number, readonly [number, number, number][]> = {
    1: [[gap + 1, 6, -10]],
    2: [[-8, -gap - 7, 62], [gap + 2, 5, -12]],
    3: [[-gap - 5, -gap + 1, 48], [-1, -gap - 10, 24], [gap + 3, 5, -14]],
    4: [[-gap - 10, -gap + 5, 52], [-gap + 3, -gap - 11, 34], [8, -gap - 7, 12], [gap + 3, 5, -14]],
  }
  return (templates[total] ?? []).map(([dx, dy, angleDeg]) => ({
    x: cornerX + dx,
    y: cornerY + dy,
    angleDeg,
  }))
}

/** motion custom：从右上角 action anchor 轻量 fan-out，退场反向收拢。 */
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
  /** 锚点元素 ref（优先）：Action Arc 读取它的 visual bounds 与右上角锚点。 */
  readonly anchorRef?: RefObject<Element | null>
  readonly anchorRect?: ObjectOrbitAnchorRect | null
  /** 无障碍名称（如「会话 xx 的动作」；身份不在此渲染——身体在画布上） */
  readonly ariaLabel?: string
  readonly actions: readonly ObjectOrbitAction[]
}

/**
 * ObjectOrbit —— 语义行为壳：top-right Action Arc + explicit lifecycle dismissal。
 * 层与动作只在 open 期间存在（HUD 零侵入）；pointer leave 不改变 click-open 状态。
 */
export function ObjectOrbit({ open, onClose, anchorRef, anchorRect, ariaLabel, actions }: ObjectOrbitProps) {
  const layerRootRef = useRef<HTMLDivElement | null>(null)
  const anchorNodeRef = useRef<Element | null>(null)
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
  const actionAnchor = rect === null ? null : { x: rect.x + rect.width, y: rect.y }

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

  // Esc is intentionally NOT owned by a second window listener here. The global
  // overlayStack arbiter closes only the current top layer, so a Compact Composer
  // above the Action Arc receives the first Esc and the Arc remains underneath.

  /** Keep the latest DOM anchor without making caller ref-object identity part of listener ownership. */
  useEffect(() => {
    anchorNodeRef.current = anchorRef?.current ?? null
  })

  /** outside press（capture pointerdown；层内/锚点身体内不算外——P0-B 教训走 capture） */
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target !== null && layerRootRef.current?.contains(target) === true) return
      if (target !== null && anchorNodeRef.current?.contains(target) === true) return
      // A22 layered transient rule: a Compact Composer/popover registered above this
      // Action Arc gets the first outside press. Do not collapse both layers at once.
      const stack = queryStack()
      if (stack[stack.length - 1]?.id !== orbitId) return
      close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, close, orbitId])

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
      {open && actionAnchor !== null && (
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
          {visible.map((action, index) => {
            const placement = placements[index]
            if (placement === undefined) return null
            const custom: SatelliteCustom = { dx: actionAnchor.x - placement.x, dy: actionAnchor.y - placement.y }
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