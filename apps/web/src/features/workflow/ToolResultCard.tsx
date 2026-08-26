/**
 * 工具结果卡片（0.5 波轻组件）。
 * 结构语义照抄 grok-bot 的 tool-results/view.tsx（MIT）：
 * <details> 折叠卡，summary = 标题（path ?? command ?? kind，等宽）+ 状态徽标，
 * body = 工作目录 + 详情 pre（streaming 时 aria-live polite）+ diff pre。
 * 样式不抄 CARD_STYLE 内联——用 LCOS Glaze 类名 .lcos-tool-result-card（见 spatial-components.css）。
 * 静态文档流元素，无 z-index。
 */

export interface ToolResultSnapshot {
  readonly toolCallId?: string
  readonly kind: string
  readonly status: 'pending' | 'running' | 'done' | 'failed'
  readonly path?: string
  readonly command?: string
  readonly workingDirectory?: string
  readonly summary?: string
  readonly output?: string
  readonly diff?: string
  readonly isStreaming?: boolean
}

export interface ToolResultCardProps {
  readonly expanded?: boolean
  readonly snapshot: ToolResultSnapshot
}

/** 状态 → 中文文案（0.5 波 GUI 收口：不再把 pending/running/done/failed 英文枚举直出给用户）。 */
export function toolResultStatusLabel(status: ToolResultSnapshot['status']): string {
  switch (status) {
    case 'pending': return '等待中'
    case 'running': return '运行中'
    case 'done': return '完成'
    case 'failed': return '失败'
  }
}

/** 只读结果卡：只呈现快照，不承载复制/打开/执行等动作。 */
export function ToolResultCard({ expanded = false, snapshot }: ToolResultCardProps) {
  const heading = snapshot.path ?? snapshot.command ?? snapshot.kind
  const detail = snapshot.summary || snapshot.output || ''
  const diff = snapshot.diff ?? ''
  return (
    <details
      className="lcos-tool-result-card"
      aria-label={snapshot.kind}
      data-tool-call-id={snapshot.toolCallId}
      data-tool-result-kind={snapshot.kind}
      data-tool-result-status={snapshot.status}
      open={expanded}
    >
      <summary className="lcos-tool-result-card-summary" data-tool-result-summary={heading}>
        <code>{heading}</code>
        <span className={`lcos-tool-result-state state-${snapshot.status}`} data-tool-result-state={snapshot.status}>{toolResultStatusLabel(snapshot.status)}</span>
      </summary>
      <div className="lcos-tool-result-card-body">
        {snapshot.workingDirectory == null ? null : <code className="lcos-tool-result-card-cwd" data-tool-working-directory>{snapshot.workingDirectory}</code>}
        {detail.length === 0 ? null : (
          <pre className="lcos-tool-result-card-pre" aria-live={snapshot.isStreaming ? 'polite' : 'off'} aria-relevant="additions text" role="log">{detail}</pre>
        )}
        {diff.length === 0 ? null : (
          <pre className="lcos-tool-result-card-pre lcos-tool-result-card-diff" data-tool-result-diff aria-label={snapshot.path ?? snapshot.kind}>{diff}</pre>
        )}
      </div>
    </details>
  )
}
