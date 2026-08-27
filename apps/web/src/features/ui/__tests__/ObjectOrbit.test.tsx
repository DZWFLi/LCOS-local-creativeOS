import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Eye, Crosshair, Boxes, Bot, Pencil, Link2, Trash2 } from 'lucide-react'
import { iconShapes } from '../iconShapes'
import { ObjectOrbit, ObjectOrbitCard } from '../ObjectOrbit'
import type { ObjectOrbitAction, ObjectOrbitEntry } from '../ObjectOrbit'

/**
 * ObjectOrbit 契约测试（Wave B-6，Grammar §13 / §11 + 游戏 GUI 裁决 §2.2/§3.2 +
 * grok-bot Donor Map B1）。
 *
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom）——与 LcosIcon / command-palette
 * 同一先例：
 *   - 静态结构用 renderToStaticMarkup 断言（渲染 ObjectOrbitCard 内容本体：
 *     Base UI Portal 需客户端挂载，SSR 只渲染内容组件）；
 *   - 行为接线（onClick 绑定 / overlayStack 注册 / pointer leave 容错 / 锚点）
 *     用源码契约断言——与 tests/nodeInfoPopoverContract.test.ts 同一先例。
 */

const noop = (): void => {}

const ENTRY: ObjectOrbitEntry = {
  title: '需求文档·草案三',
  kindLabel: '文档',
  kindShape: 'paper',
  statusText: '生成中',
  statusTone: 'active',
}

/** Grammar §11 四高频示例 + Donor Map B1 三个低频项（第 6/7 个验证 More 收纳） */
const SEVEN_ACTIONS: ObjectOrbitAction[] = [
  { id: 'preview', label: '预览', icon: Eye, primary: true, onClick: noop },
  { id: 'focus', label: '在哪', icon: Crosshair, onClick: noop },
  { id: 'assemble', label: '组织', icon: Boxes, onClick: noop },
  { id: 'agent', label: 'Agent', icon: Bot, onClick: noop },
  { id: 'rename', label: '重命名', icon: Pencil, onClick: noop },
  { id: 'copy-id', label: '复制 ID', icon: Link2, onClick: noop },
  { id: 'delete', label: '删除', icon: Trash2, onClick: noop },
]

function renderCard(
  entry: ObjectOrbitEntry = ENTRY,
  actions: readonly ObjectOrbitAction[] = SEVEN_ACTIONS,
  open = true,
): string {
  return renderToStaticMarkup(
    <ObjectOrbitCard entry={entry} actions={actions} open={open} onAction={noop} />,
  )
}

describe('ObjectOrbitCard 静态结构（图鉴卡四件套，裁决 §2.2/§3.2）', () => {
  it('四件套齐备：立绘区（kindShape 剪影 48px）/ 名字 / 类型徽章 / 状态行', () => {
    const html = renderCard()
    // ① 立绘区：形状即身份——kindShape 的容器 path 原样渲染 + 48px 冻结边长
    expect(html).toContain('class="lcos-orbit-portrait"')
    expect(html).toContain(`d="${iconShapes.paper.path}"`)
    expect(html).toContain('width:48px')
    // ② 名字
    expect(html).toContain('class="lcos-orbit-title"')
    expect(html).toContain('>需求文档·草案三<')
    // ③ 类型徽章（胶囊）
    expect(html).toContain('class="lcos-orbit-kind-badge"')
    expect(html).toContain('>文档<')
    // ④ 状态行（小字 + 语气 data 属性）
    expect(html).toContain('class="lcos-orbit-status"')
    expect(html).toContain('>生成中<')
    expect(html).toContain('data-lcos-tone="active"')
  })

  it('statusText 缺省：状态行整行不渲染（不造假状态）', () => {
    const html = renderCard({ ...ENTRY, statusText: undefined })
    expect(html).not.toContain('lcos-orbit-status')
  })

  it('一级 satellite ≤5 冻结（Grammar §13）：7 动作只显 5，超出收 More 折叠入口', () => {
    const html = renderCard()
    const satelliteButtons = html.match(/data-lcos-orbit-action="/g) ?? []
    expect(satelliteButtons.length).toBe(5)
    expect(html).toContain('data-lcos-orbit-action="preview"')
    expect(html).toContain('data-lcos-orbit-action="rename"') // 第 5 个仍在列
    expect(html).not.toContain('data-lcos-orbit-action="copy-id"') // 第 6 个不显
    expect(html).not.toContain('data-lcos-orbit-action="delete"') // 第 7 个不显
    expect(html).not.toContain('>复制 ID<')
    // More 折叠入口（默认收起）
    expect(html).toContain('data-lcos-orbit-more="true"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('动作 ≤5 时不渲染 More 折叠（Donor Map B1：不预造瑞士军刀）', () => {
    const html = renderCard(ENTRY, SEVEN_ACTIONS.slice(0, 3))
    expect((html.match(/data-lcos-orbit-action="/g) ?? []).length).toBe(3)
    expect(html).not.toContain('data-lcos-orbit-more')
  })

  it('primary 卫星带唯一 data-lcos-primary 标记（视觉突出开关）', () => {
    const html = renderCard()
    const primaryMarks = html.match(/data-lcos-primary="true"/g) ?? []
    expect(primaryMarks.length).toBe(1)
  })

  it('动作绑定位点：每个可见动作渲染为携带自身 id 的 button + 图标容器剪影', () => {
    const html = renderCard()
    expect(html).toMatch(/<button[^>]*data-lcos-orbit-action="preview"[^>]*>/)
    expect(html).toMatch(/<button[^>]*data-lcos-orbit-action="focus"[^>]*>/)
    expect(html).toContain('class="lcos-orbit-satellite"')
    expect(html).toContain('lcos-icon') // LcosIcon 有机容器（pebble 卫星位）
    expect(html).toContain('>预览<')
    expect(html).toContain('>在哪<')
  })

  it('卡尾 footer：极简 hint 行（Esc / 点外 / 移出收起——§13 行为自明）', () => {
    const html = renderCard()
    expect(html).toContain('class="lcos-orbit-foot"')
    expect(html).toContain('Esc 关闭')
    expect(html).toContain('移出 300ms')
  })

  it('收场帧（open=false）：卡体结构完整保留（供 200ms 反向收拢动画挂载）', () => {
    const html = renderCard(ENTRY, SEVEN_ACTIONS.slice(0, 3), false)
    expect(html).toContain('lcos-orbit-card')
    expect((html.match(/data-lcos-orbit-action="/g) ?? []).length).toBe(3)
  })
})

describe('ObjectOrbit 行为壳契约（node 环境源码断言先例）', () => {
  const shell = readFileSync(new URL('../ObjectOrbit.tsx', import.meta.url), 'utf8')

  it('动作 onClick 绑定：卫星 onClick → onAction → action.onClick() 后统一收口关闭', () => {
    expect(shell).toContain('onClick={() => onAction(action)}')
    expect(shell).toContain('action.onClick()')
    // transient orbit：动作执行后立即收口（先动作后关闭）
    expect(shell).toMatch(/action\.onClick\(\)\s*\n\s*close\(\)/)
  })

  it('overlayStack 注册：kind orbit / onEsc=close / dismissOnOutside=true（任务书冻结）', () => {
    expect(shell).toContain("kind: 'orbit'")
    expect(shell).toContain('onEsc: close')
    expect(shell).toContain('dismissOnOutside: true')
    expect(shell).toContain("import { register as registerOverlay } from './overlayStack'")
  })

  it('pointer leave 容错（Grammar §13）：300ms 延迟关闭，re-enter 取消', () => {
    expect(shell).toContain('POINTER_LEAVE_CLOSE_DELAY_MS = 300')
    expect(shell).toContain('window.setTimeout(')
    expect(shell).toContain('window.clearTimeout(leaveTimerRef.current)')
    expect(shell).toContain('onMouseEnter={cancelLeaveClose}')
    expect(shell).toContain('onMouseLeave={scheduleLeaveClose}')
  })

  it('Base UI Popover 驱动：anchorRef/anchorRect 双锚 + 玻璃底板复用 + Esc/outside 统一收口', () => {
    expect(shell).toContain("from '@base-ui/react/popover'")
    expect(shell).toContain('anchor={anchor}')
    expect(shell).toContain('getBoundingClientRect') // anchorRect → 虚拟锚
    expect(shell).toContain('lcos-popover lcos-popover-anim lcos-orbit') // 玻璃底板冻结规格复用
    expect(shell).toContain('if (!next) close()') // onOpenChange(false) → onClose
  })

  it('壳渲染卡本体：ObjectOrbit 内嵌 ObjectOrbitCard（内容模板单一来源）', () => {
    expect(shell).toContain('<ObjectOrbitCard')
  })

  it('SSR 安全：完整壳在 node 环境静态渲染不抛错（Portal 延迟到客户端）', () => {
    const html = renderToStaticMarkup(
      <ObjectOrbit
        open
        onClose={noop}
        anchorRect={{ x: 100, y: 100, width: 80, height: 40 }}
        entry={ENTRY}
        actions={SEVEN_ACTIONS}
      />,
    )
    expect(typeof html).toBe('string')
    // Base UI Portal 需客户端挂载：SSR 不输出卡体（运行时由客户端渲染）
    expect(html).not.toContain('lcos-orbit-card')
  })
})
