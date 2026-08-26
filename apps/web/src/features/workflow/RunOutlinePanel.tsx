/**
 * Run 过程大纲面板（第一梯队 ④）——WorkRail 内的只读侧栏。
 * 结构参考 grok-bot conversation-outline-view（MIT）：顶部状态横幅 + 条目行
 * （状态图标 + 等宽 label + 可展开 detail）+ 行级 aria（role=list/listitem）。
 * 不抄的部分：subagent tab、movable panel、条目点击导航——LCOS 0.1 纯只读，
 * 点击条目不触发任何画布动作（定位到节点留后续）。
 * 折叠用原生 <details>：open 是静态 prop，React 只在值变化时回写 DOM，
 * 事件轮询引起的重渲染不会把用户手动折叠的面板掀开。
 */

import { Check, Circle, Info, LoaderCircle, X } from 'lucide-react'
import { runStatusLabel, type RunStatus } from '../../model'
import type { RunOutlineItem, RunOutlineItemStatus } from './RunOutlineProvider'

export interface RunOutlinePanelProps {
  /** 当前 Run 状态：驱动顶部状态色条与横幅 chip。 */
  readonly status: RunStatus
  /** 大纲条目（buildRunOutline 投影产物）。 */
  readonly items: readonly RunOutlineItem[]
}

/** 状态图标：done=✓(confirm 绿) / failed=✗(error 红) / running=转圈(working 蓝) / pending=空心灰 / info=中性。 */
function outlineMarkIcon(status: RunOutlineItemStatus) {
  switch (status) {
    case 'done': return <Check size={12} strokeWidth={2.4} />
    case 'failed': return <X size={12} strokeWidth={2.4} />
    case 'running': return <LoaderCircle size={12} strokeWidth={2.2} />
    case 'pending': return <Circle size={11} strokeWidth={1.5} />
    default: return <Info size={12} strokeWidth={2} />
  }
}

/** 行级 aria 用的状态中文：图标对读屏不可见，用 aria-label 补语义。 */
const OUTLINE_STATUS_TEXT: Record<RunOutlineItemStatus, string> = {
  pending: '待处理',
  running: '进行中',
  done: '已完成',
  failed: '失败',
  info: '记录',
}

/** 只读大纲面板：只呈现投影条目，不动画布、不导航、不改数据。 */
export function RunOutlinePanel({ status, items }: RunOutlinePanelProps) {
  // 进度摘要：done/failed 条目 + 已发生的事件都算"已完成"（事件每来一条，数字 +1）。
  const finished = items.filter((item) => item.status === 'done' || item.status === 'failed' || item.kind === 'event').length
  return (
    <details className="lcos-run-outline" data-run-status={status} data-testid="run-outline" aria-label="执行过程大纲" open>
      <summary className="lcos-run-outline-summary">
        <span className="lcos-run-outline-title">执行过程</span>
        {items.length === 0 ? null : <span className="lcos-run-outline-progress" data-testid="run-outline-progress">{`${finished}/${items.length}`}</span>}
        <span className={`lcos-run-outline-state state-${status}`}>{runStatusLabel[status]}</span>
      </summary>
      {items.length === 0 ? (
        <p className="lcos-run-outline-empty">任务开始后，这里会显示执行进度。</p>
      ) : (
        <ol className="lcos-run-outline-items" role="list">
          {items.map((item) => (
            <li key={item.id} role="listitem" data-kind={item.kind} data-status={item.status} aria-label={`${item.label} · ${OUTLINE_STATUS_TEXT[item.status]}`}>
              <div className="lcos-run-outline-row">
                <i className={`lcos-run-outline-mark status-${item.status}`} aria-hidden="true">{outlineMarkIcon(item.status)}</i>
                <code className="lcos-run-outline-label">{item.label}</code>
                {item.badge == null ? null : <span className="lcos-run-outline-badge">{item.badge}</span>}
              </div>
              {item.detail == null || item.detail.length === 0 ? null : (
                <details className="lcos-run-outline-item-detail">
                  <summary>详情</summary>
                  <pre>{item.detail}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
