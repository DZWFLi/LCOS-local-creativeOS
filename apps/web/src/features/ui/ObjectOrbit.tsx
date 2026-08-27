/**
 * ObjectOrbit —— 对象局部动作语言通用壳（Wave B-6：图鉴卡四件套模板 + Base UI 行为层）。
 *
 * 纪律来源（宪法级原话）：
 * - Design Grammar §13：「Orbit 是对象局部动作语言，不是 radial menu 炫技。规则：3~5 个
 *   一级 satellite 为上限；只对 single active object 出现；围绕 object，不遮 body；
 *   使用 Apple floating material；LCOS 决定布局与语义；低频动作进入 More/context menu；
 *   Orbit 不替代右键菜单；pointer leave / Esc / outside click 行为统一。」
 * - Grammar §11：「单击一个对象：Select + Local Orbit。Orbit 只显示少数最高频动作，
 *   例如 Preview/Enter、Focus/在哪、Assemble/Organize、Agent action、More。」
 * - 游戏 GUI 裁决 §2.2 / §3.2：「生物卡 = 清晰立绘区 + 名字 + 类型徽章 + 状态——这就是
 *   Glyth Orbit 的内容模板，不是 SaaS 属性面板」→ 卡头四件套（立绘/名/类型徽章/状态）。
 * - grok-bot Donor Map B1：「一级最多：……低频再进次级菜单……否则会从宝可梦变成瑞士军刀。」
 *   → 一级 satellite ≤5，超出自动收进 More 折叠（本刀 More 为简单折叠，真 context menu 后续批）。
 *
 * 行为层构成（全部复用既有基建，不另起炉灶）：
 * - Base UI Popover（A0-1 LcosPopover 同款驱动）：Esc / outside press 由 Root 的
 *   useDismiss 统一收口 → onOpenChange(false) → onClose；
 * - overlayStack（A0-4）：register(kind:'orbit', onEsc=close, dismissOnOutside=true)，
 *   并入全局「一次交互收一层」裁决链（UX收口 §9.2）；
 * - pointer leave 容错（Grammar §13）：leave 后 300ms 延迟关闭，期间 re-enter 取消。
 *
 * 动画方案：motion 库（motion@12，仓内 PdfViewer / ContextComponentRenderers 已有
 * import 'motion/react' 先例，构建链已验证无需 vite 配置调整）——
 *   出场：satellite 逐个 stagger（variants staggerChildren 0.06s，落在 0.04~0.08s 区间），
 *         spring(400/25) 级入场；
 *   收场：反向收拢（opacity + scale .92，200ms ease-out，倒序 stagger）——与玻璃底板
 *         data-ending-style 退场（scale .92 + opacity 200ms，LcosPopover 冻结值）同窗播放：
 *         Base UI 在退场过渡期间保持 popup 挂载，open=false 的收场帧恰好驱动本卡 animate='exiting'。
 *   若未来 motion 引入出现构建问题，降级路径：CSS animation-delay 逐个延迟 + 同款
 *   ending-style 收场（本文件 variants 值即降级规格源）。
 *
 * 边界（本刀纪律）：通用原语壳，不含 Glyth 专属动作；接线 CanvasNodeVisual / ProjectCanvas
 * 属 Wave C 接线批次。anchorRef / anchorRect 二选一：锚点 DOM ref 优先，无 DOM 锚（如
 * 画布坐标）时以 anchorRect 虚拟锚定位（floating-ui VirtualElement）。
 *
 * 使用示例（供 Wave C 接线参考，本文件不接线）：
 *   <ObjectOrbit
 *     open={selectedNode !== null}
 *     onClose={() => setSelectedNode(null)}
 *     anchorRef={nodeVisualRef}
 *     entry={{ title: node.title, kindLabel: '文档', kindShape: 'paper',
 *               statusText: '生成中', statusTone: 'active' }}
 *     actions={[
 *       { id: 'preview', label: '预览', icon: Eye, primary: true, onClick: openPreview },
 *       { id: 'focus', label: '在哪', icon: Crosshair, onClick: locateNode },
 *     ]}
 *   />
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Box, Ellipsis } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { Popover } from '@base-ui/react/popover'
import type { PopoverPositionerProps } from '@base-ui/react/popover'
import { LcosIcon } from './LcosIcon'
import type { LcosIconShape } from './iconShapes'
import { register as registerOverlay } from './overlayStack'
import './ui-primitives.css'

/** Grammar §13：一级 satellite 上限（3~5 取上界；超出收进 More 折叠） */
const MAX_VISIBLE_SATELLITES = 5
/** Grammar §13「pointer leave 行为统一」：离开 300ms 后关，期间 re-enter 取消 */
const POINTER_LEAVE_CLOSE_DELAY_MS = 300
/** 图鉴卡立绘区边长（游戏裁决 §2.2「清晰立绘区」） */
const PORTRAIT_SIZE = 48
/** Grammar §13 编排区间（0.04~0.08s）取中：satellite 逐个出场间隔 */
const SATELLITE_STAGGER = 0.06
/** 收场时长：与玻璃底板 data-ending-style 冻结值同窗（200ms） */
const SATELLITE_EXIT_DURATION = 0.2

/* ── motion variants：出场 stagger（spring 400/25 级）＋ 收场反向（§13 / 任务书）── */
const orbitRowVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: SATELLITE_STAGGER, delayChildren: 0.03 } },
  exiting: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
}

const orbitSatelliteVariants: Variants = {
  hidden: { opacity: 0, scale: 0.86, y: 4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exiting: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: SATELLITE_EXIT_DURATION, ease: 'easeOut' },
  },
}

/** 状态行语气（四件套之四）：色源全部走仓内冻结语义 token */
export type ObjectOrbitStatusTone = 'neutral' | 'active' | 'warn' | 'danger'

/** 图鉴卡头四件套数据（裁决 §2.2：立绘区/名字/类型徽章/状态） */
export interface ObjectOrbitEntry {
  /** 对象名（名字） */
  readonly title: string
  /** 类型徽章文案（如「会话」「文档」） */
  readonly kindLabel: string
  /** 立绘区形状（形状即身份，七形状之一；glyph 用中性 Box，对象专属形态属 Wave C 接线） */
  readonly kindShape: LcosIconShape
  /** 状态行文案（缺省不渲染状态行） */
  readonly statusText?: string
  /** 状态行语气（默认 neutral） */
  readonly statusTone?: ObjectOrbitStatusTone
}

/** Orbit 一级动作（Grammar §11：少数最高频动作；低频勿塞入，走 More 由调用方排序保证） */
export interface ObjectOrbitAction {
  readonly id: string
  readonly label: string
  readonly icon?: LucideIconAlias
  readonly onClick: () => void
  /** primary 动作在卫星区视觉突出（填充胶囊），不改变顺序 */
  readonly primary?: boolean
}

/** 视口坐标锚框（anchorRef 缺席时的虚拟锚，如画布空间坐标） */
export interface ObjectOrbitAnchorRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Lucide glyph 类型别名（LcosIcon 的 icon 契约） */
type LucideIconAlias = import('lucide-react').LucideIcon

export interface ObjectOrbitProps {
  /** 受控开关：true 挂载锚点旁浮层（只对 single active object 出现，由调用方保证） */
  readonly open: boolean
  /** 统一关闭出口：Esc / outside press / pointer leave / 动作执行后都经此收口 */
  readonly onClose: () => void
  /** 锚点元素 ref（优先） */
  readonly anchorRef?: RefObject<HTMLElement | null>
  /** 锚点视口矩形（无 DOM 锚时使用） */
  readonly anchorRect?: ObjectOrbitAnchorRect | null
  readonly entry: ObjectOrbitEntry
  readonly actions: readonly ObjectOrbitAction[]
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ObjectOrbitCard —— 图鉴卡内容（四件套卡头 + satellite 区 + More 折叠 + 卡尾）。
 * 单独导出：ObjectOrbit 的 Popup 内容本体；静态结构测试（renderToStaticMarkup）
 * 直接渲染此卡（Base UI Portal 需客户端挂载，SSR 只渲染内容组件——与
 * CommandPalette 测试先例同理）。
 * ──────────────────────────────────────────────────────────────────────────── */
export interface ObjectOrbitCardProps {
  readonly entry: ObjectOrbitEntry
  readonly actions: readonly ObjectOrbitAction[]
  /**
   * false 视为收场帧：satellite 切换到 exiting variants（反向收拢 200ms），
   * 与玻璃底板 data-ending-style 退场同窗；true 时逐个 stagger 出场。
   */
  readonly open: boolean
  /** 卫星点击出口：壳层负责执行 action.onClick 并收口关闭 */
  readonly onAction: (action: ObjectOrbitAction) => void
}

export function ObjectOrbitCard({ entry, actions, open, onAction }: ObjectOrbitCardProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  /** Grammar §13 / Donor Map B1：一级 ≤5；超出整批收 More 折叠 */
  const visible = actions.slice(0, MAX_VISIBLE_SATELLITES)
  const overflow = actions.slice(MAX_VISIBLE_SATELLITES)

  return (
    <div className="lcos-orbit-card">
      {/* 图鉴卡头四件套：立绘区（形状即身份）+ 名字 + 类型徽章胶囊 + 状态行 */}
      <div className="lcos-orbit-head">
        <span className="lcos-orbit-portrait" aria-hidden="true">
          <LcosIcon shape={entry.kindShape} icon={Box} size={PORTRAIT_SIZE} />
        </span>
        <span className="lcos-orbit-id">
          <span className="lcos-orbit-title">{entry.title}</span>
          <span className="lcos-orbit-kind-badge">{entry.kindLabel}</span>
          {entry.statusText !== undefined ? (
            <span
              className="lcos-orbit-status"
              data-lcos-tone={entry.statusTone ?? 'neutral'}
            >
              {entry.statusText}
            </span>
          ) : null}
        </span>
      </div>

      {/* satellite 区：水平 flex（真弧形排布属后续打磨批次，见 CSS 段注释预留） */}
      <motion.div
        className="lcos-orbit-satellites"
        variants={orbitRowVariants}
        initial="hidden"
        animate={open ? 'visible' : 'exiting'}
      >
        {visible.map((action) => (
          <motion.button
            key={action.id}
            type="button"
            className="lcos-orbit-satellite"
            variants={orbitSatelliteVariants}
            data-lcos-orbit-action={action.id}
            data-lcos-primary={action.primary === true ? 'true' : undefined}
            onClick={() => onAction(action)}
          >
            {action.icon !== undefined ? (
              <LcosIcon shape="pebble" icon={action.icon} size={16} />
            ) : null}
            <span className="lcos-orbit-satellite-label">{action.label}</span>
          </motion.button>
        ))}
        {overflow.length > 0 ? (
          <motion.button
            key="__orbit-more"
            type="button"
            className="lcos-orbit-satellite lcos-orbit-more"
            variants={orbitSatelliteVariants}
            data-lcos-orbit-more="true"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
          >
            <LcosIcon shape="pebble" icon={Ellipsis} size={16} />
            <span className="lcos-orbit-satellite-label">More</span>
          </motion.button>
        ) : null}
      </motion.div>

      {/* More 折叠（本刀简单折叠；真 context menu 属后续批次） */}
      <AnimatePresence initial={false}>
        {moreOpen && overflow.length > 0 ? (
          <motion.div
            key="orbit-more-fold"
            className="lcos-orbit-more-fold"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {overflow.map((action) => (
              <button
                key={action.id}
                type="button"
                className="lcos-orbit-satellite lcos-orbit-satellite--fold"
                data-lcos-orbit-action={action.id}
                onClick={() => onAction(action)}
              >
                {action.icon !== undefined ? (
                  <LcosIcon shape="pebble" icon={action.icon} size={16} />
                ) : null}
                <span className="lcos-orbit-satellite-label">{action.label}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 卡尾：极简 hint 行（Grammar §13 行为统一的自明文案） */}
      <div className="lcos-orbit-foot">Esc 关闭 · 点外收起 · 移出 300ms 收起</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ObjectOrbit —— 行为壳：Base UI Popover 驱动 + overlayStack 注册 +
 * pointer leave 容错 + 动作执行后统一收口。
 * ──────────────────────────────────────────────────────────────────────────── */
export function ObjectOrbit({ open, onClose, anchorRef, anchorRect, entry, actions }: ObjectOrbitProps) {
  const cardRootRef = useRef<HTMLDivElement | null>(null)
  const leaveTimerRef = useRef<number | null>(null)
  const orbitId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const close = useCallback(() => {
    onCloseRef.current()
  }, [])

  /** anchorRect → floating-ui VirtualElement（Base UI Positioner 原生锚类型） */
  const virtualAnchor = useMemo(() => {
    if (anchorRect === undefined || anchorRect === null) return undefined
    return {
      getBoundingClientRect: () => ({
        x: anchorRect.x,
        y: anchorRect.y,
        top: anchorRect.y,
        left: anchorRect.x,
        right: anchorRect.x + anchorRect.width,
        bottom: anchorRect.y + anchorRect.height,
        width: anchorRect.width,
        height: anchorRect.height,
      }),
    }
  }, [anchorRect])
  const anchor: PopoverPositionerProps['anchor'] = anchorRef ?? virtualAnchor

  /** overlayStack（A0-4）：kind 'orbit'，onEsc=close，dismissOnOutside=true（任务书冻结） */
  useEffect(() => {
    if (!open) return undefined
    const unregister = registerOverlay(orbitId, {
      kind: 'orbit',
      element: () => cardRootRef.current,
      onEsc: close,
      dismissOnOutside: true,
    })
    return unregister
  }, [open, orbitId, close])

  const cancelLeaveClose = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const scheduleLeaveClose = useCallback(() => {
    cancelLeaveClose()
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null
      close()
    }, POINTER_LEAVE_CLOSE_DELAY_MS)
  }, [cancelLeaveClose, close])

  /* 卸载与关场时清 leave 计时器（不误伤下一次打开） */
  useEffect(() => cancelLeaveClose, [cancelLeaveClose])
  useEffect(() => {
    if (!open) cancelLeaveClose()
  }, [open, cancelLeaveClose])

  /** 卫星执行：先动作后收口（transient orbit：单击即完成并消失） */
  const handleAction = useCallback(
    (action: ObjectOrbitAction) => {
      action.onClick()
      close()
    },
    [close],
  )

  /** Grammar §13：Esc / outside press 行为统一——Base UI 的任何 close 理由都走 onClose */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) close()
    },
    [close],
  )

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Portal>
        <Popover.Positioner
          className="lcos-orbit-positioner"
          anchor={anchor}
          side="bottom"
          align="center"
          sideOffset={8}
        >
          {/* 玻璃底板复用 lcos-popover 冻结规格（Apple floating material）+
              lcos-popover-anim 出/退场（退场 scale .92 + opacity 200ms 即任务书收场值） */}
          <Popover.Popup className="lcos-popover lcos-popover-anim lcos-orbit" data-lcos-width={320}>
            <div
              ref={cardRootRef}
              className="lcos-orbit-root"
              onMouseEnter={cancelLeaveClose}
              onMouseLeave={scheduleLeaveClose}
            >
              <ObjectOrbitCard entry={entry} actions={actions} open={open} onAction={handleAction} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
