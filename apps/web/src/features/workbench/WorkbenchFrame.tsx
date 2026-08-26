import type { ReactNode } from 'react'

import { runStatusLabel, type RunStatus } from '../../model'

/**
 * WorkbenchFrame 四区 UI 壳（施工单第一梯队 ② 轻量版）
 *
 * 结构：header（标题 + Run 状态徽标）/ 左区（大纲侧栏插槽）/ 中区（内容插槽）/ 右区（工具结果卡插槽）。
 * 四区全部用 slot props 透传，不做死布局——RunOutlinePanel 挂左区、ToolResultCard 挂右区，由主线接线。
 *
 * 借鉴 grok-bot computer/shell 状态机的 active/idle 思想但只做 UI 壳：
 * 有进行中 Run（queued/running/waiting_input/review）时顶部显示「运行中」横幅 + 取消按钮插槽；
 * 无 Run 或已终态时显示常态 header。本壳不接线、不实现取消逻辑。
 */

/** 运行相位：active=有进行中的 Run（横幅态）；idle=常态。 */
export type WorkbenchRunPhase = 'active' | 'idle'

/** 纯函数：RunStatus → 横幅相位。终态（completed/failed/cancelled）与无 Run 同为常态。 */
export function workbenchRunPhase(runStatus: RunStatus | null | undefined): WorkbenchRunPhase {
  return runStatus === 'queued' || runStatus === 'running' || runStatus === 'waiting_input' || runStatus === 'review'
    ? 'active'
    : 'idle'
}

export interface WorkbenchFrameProps {
  /** header 主标题。 */
  title: string
  /** header 小标（如「内容工作台」）；可选。 */
  kicker?: string
  /** Run 状态徽标：null/undefined = 无 Run 常态；非终态额外显示运行横幅。 */
  runStatus?: RunStatus | null
  /** 左区：大纲侧栏插槽（RunOutlinePanel 挂这里）。 */
  outlineSidebar?: ReactNode
  /** 中区：内容插槽。 */
  children?: ReactNode
  /** 右区：工具结果卡插槽（ToolResultCard 挂这里）。 */
  toolResultPanel?: ReactNode
  /** 运行横幅右侧动作插槽（取消按钮等；壳只留槽不实现逻辑）。 */
  bannerAction?: ReactNode
  /** header 右侧动作插槽（关闭/定位按钮，由宿主提供）。 */
  headerAction?: ReactNode
}

export function WorkbenchFrame(props: WorkbenchFrameProps) {
  const { title, kicker, runStatus = null, outlineSidebar, children, toolResultPanel, bannerAction, headerAction } = props
  const phase = workbenchRunPhase(runStatus)
  return (
    <section
      className="lcos-workbench-frame"
      data-testid="workbench-frame"
      data-run-phase={phase}
      role="region"
      aria-label={`${title} 工作台`}
    >
      {phase === 'active' && runStatus !== null && (
        <div className="lcos-workbench-frame-banner" data-testid="workbench-frame-run-banner" role="status">
          <span className="lcos-workbench-frame-banner-led" aria-hidden="true"><i /></span>
          <span className="lcos-workbench-frame-banner-text">运行中 · {runStatusLabel[runStatus]}</span>
          {bannerAction !== undefined && <div className="lcos-workbench-frame-banner-action">{bannerAction}</div>}
        </div>
      )}
      <header className="lcos-workbench-frame-header">
        <div className="lcos-workbench-frame-heading">
          {kicker !== undefined && <small className="lcos-workbench-frame-kicker">{kicker}</small>}
          <h3 className="lcos-workbench-frame-title" title={title}>{title}</h3>
        </div>
        <div className="lcos-workbench-frame-header-side">
          {runStatus !== null && (
            <span className={`lcos-workbench-frame-run-badge is-${runStatus}`} data-run-status={runStatus}>
              <i aria-hidden="true" />
              {runStatusLabel[runStatus]}
            </span>
          )}
          {headerAction !== undefined && <div className="lcos-workbench-frame-header-action">{headerAction}</div>}
        </div>
      </header>
      <div className="lcos-workbench-frame-body">
        {outlineSidebar !== undefined && (
          <aside className="lcos-workbench-frame-zone lcos-workbench-frame-left" data-testid="workbench-frame-outline" data-zone="outline" aria-label="过程大纲">
            {outlineSidebar}
          </aside>
        )}
        <main className="lcos-workbench-frame-zone lcos-workbench-frame-center" data-testid="workbench-frame-content" data-zone="content">
          {children}
        </main>
        {toolResultPanel !== undefined && (
          <aside className="lcos-workbench-frame-zone lcos-workbench-frame-right" data-testid="workbench-frame-tool-results" data-zone="tool-results" aria-label="工具结果">
            {toolResultPanel}
          </aside>
        )}
      </div>
    </section>
  )
}
