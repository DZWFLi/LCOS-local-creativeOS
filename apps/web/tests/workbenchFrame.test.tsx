import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkbenchFrame, workbenchRunPhase } from '../src/features/workbench/WorkbenchFrame'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')

describe('WORKBENCH-FRAME 相位纯函数（workbenchRunPhase）', () => {
  it('非终态为 active：queued/running/waiting_input/review 显示运行横幅', () => {
    expect(workbenchRunPhase('queued')).toBe('active')
    expect(workbenchRunPhase('running')).toBe('active')
    expect(workbenchRunPhase('waiting_input')).toBe('active')
    expect(workbenchRunPhase('review')).toBe('active')
  })

  it('终态与无 Run 为 idle：completed/failed/cancelled/null/undefined 均为常态 header', () => {
    expect(workbenchRunPhase('completed')).toBe('idle')
    expect(workbenchRunPhase('failed')).toBe('idle')
    expect(workbenchRunPhase('cancelled')).toBe('idle')
    expect(workbenchRunPhase(null)).toBe('idle')
    expect(workbenchRunPhase(undefined)).toBe('idle')
  })
})

describe('WORKBENCH-FRAME 四区壳渲染', () => {
  it('四区 DOM 存在：header + 左区大纲 + 中区内容 + 右区工具结果卡', () => {
    // 四区为 slot 透传设计（不做死布局）：传齐 outlineSidebar/toolResultPanel 时四区齐备。
    const html = renderToStaticMarkup(
      <WorkbenchFrame
        title="收口材料"
        kicker="内容工作台"
        outlineSidebar={<nav>大纲</nav>}
        toolResultPanel={<div>工具结果</div>}
      >
        <p>内容插槽占位</p>
      </WorkbenchFrame>,
    )
    expect(html).toContain('data-testid="workbench-frame"')
    expect(html).toContain('<header class="lcos-workbench-frame-header">')
    expect(html).toContain('data-testid="workbench-frame-outline"')
    expect(html).toContain('data-zone="outline"')
    expect(html).toContain('data-testid="workbench-frame-content"')
    expect(html).toContain('data-zone="content"')
    expect(html).toContain('data-testid="workbench-frame-tool-results"')
    expect(html).toContain('data-zone="tool-results"')
    expect(html).toContain('内容插槽占位')
    expect(html).toContain('<small class="lcos-workbench-frame-kicker">内容工作台</small>')
    expect(html).toContain('<h3 class="lcos-workbench-frame-title"')
  })

  it('插槽缺省不渲染空壳：左右 aside 不出现（不做死布局、无装饰性空 DOM）', () => {
    const html = renderToStaticMarkup(<WorkbenchFrame title="仅中区" />)
    expect(html).toContain('data-testid="workbench-frame-content"')
    expect(html).not.toContain('data-testid="workbench-frame-outline"')
    expect(html).not.toContain('data-testid="workbench-frame-tool-results"')
  })

  it('active 相位：顶部「运行中」横幅 + 取消按钮插槽透传 + runStatus 徽标', () => {
    const html = renderToStaticMarkup(
      <WorkbenchFrame
        title="收口材料"
        runStatus="running"
        outlineSidebar={<nav>大纲</nav>}
        toolResultPanel={<div>工具结果</div>}
        bannerAction={<button type="button">取消运行</button>}
      >
        <p>内容</p>
      </WorkbenchFrame>,
    )
    expect(html).toContain('data-run-phase="active"')
    expect(html).toContain('data-testid="workbench-frame-run-banner"')
    expect(html).toContain('role="status"')
    expect(html).toContain('运行中 · 执行中')
    expect(html).toContain('<button type="button">取消运行</button>')
    expect(html).toContain('class="lcos-workbench-frame-run-badge is-running"')
    expect(html).toContain('data-run-status="running"')
  })

  it('idle 相位：无运行横幅，常态 header；无 Run 时不渲染状态徽标', () => {
    const html = renderToStaticMarkup(
      <WorkbenchFrame title="收口材料" runStatus={null} headerAction={<button type="button" aria-label="关闭">× 关闭</button>}>
        <p>内容</p>
      </WorkbenchFrame>,
    )
    expect(html).toContain('data-run-phase="idle"')
    expect(html).not.toContain('data-testid="workbench-frame-run-banner"')
    expect(html).not.toContain('lcos-workbench-frame-run-badge')
    expect(html).toContain('<button type="button" aria-label="关闭">× 关闭</button>')
  })

  it('终态（failed/completed）回到常态 header，徽标保留并如实显示状态文案', () => {
    const failed = renderToStaticMarkup(<WorkbenchFrame title="t" runStatus="failed"><p>·</p></WorkbenchFrame>)
    expect(failed).toContain('data-run-phase="idle"')
    expect(failed).not.toContain('data-testid="workbench-frame-run-banner"')
    expect(failed).toContain('class="lcos-workbench-frame-run-badge is-failed"')
    expect(failed).toContain('执行失败')
    const completed = renderToStaticMarkup(<WorkbenchFrame title="t" runStatus="completed"><p>·</p></WorkbenchFrame>)
    expect(completed).toContain('data-run-phase="idle"')
    expect(completed).toContain('data-run-status="completed"')
    expect(completed).toContain('已完成')
  })

  it('样式契约：.lcos-workbench-frame-* 类族落在 spatial-components.css（浮岛公式 + Glaze token，零新颜色）', () => {
    const css = source('spatial-components.css')
    expect(css).toContain('.lcos-workbench-frame {')
    expect(css).toContain('.lcos-workbench-frame-banner {')
    expect(css).toContain('.lcos-workbench-frame-run-badge {')
    expect(css).toContain('.lcos-workbench-frame-left {')
    expect(css).toContain('.lcos-workbench-frame-center {')
    expect(css).toContain('.lcos-workbench-frame-right {')
    // 浮岛公式要素（与 edge-pin/minimap 同族）。
    expect(css).toMatch(/\.lcos-workbench-frame \{[^}]*border-radius: 20px/)
    expect(css).toMatch(/\.lcos-workbench-frame \{[^}]*backdrop-filter: blur\(20px\)/)
  })
})
