import { ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ContextChangeProposalV1, RunReview } from '@local-creative-os/contracts'
import type { ActiveContextProjection } from '../../runtime/localCoreClient'
import { humanizeRuntimeMessage } from '../../runtime/messages'
import type { CanvasNode } from '../../model'

export function AgentContextSurface({
  projectLabel,
  workspaceLabel,
  projection,
  selectedNodes,
  error,
  syncState,
  proposals,
  pendingRuns,
  pendingReviews,
  detailsOpen,
  runLocked,
  onAcceptProposal,
  onRejectProposal,
  onRefresh,
  onToggleDetails,
  onOpenReview,
}: {
  readonly projectLabel: string
  readonly workspaceLabel: string
  readonly projection: ActiveContextProjection | null
  readonly selectedNodes: readonly CanvasNode[]
  readonly error: string | null
  readonly syncState: 'syncing' | 'synced' | 'conflict'
  readonly proposals: readonly ContextChangeProposalV1[]
  readonly pendingRuns: number
  readonly pendingReviews: readonly RunReview[]
  readonly detailsOpen: boolean
  readonly runLocked: { readonly id: string; readonly contextCount: number } | null
  readonly onAcceptProposal: (proposalId: string) => void
  readonly onRejectProposal: (proposalId: string) => void
  readonly onRefresh: () => void
  readonly onToggleDetails: () => void
  readonly onOpenReview: (review: RunReview) => void
}) {
  // Phase D (D24)：默认折叠成小胶囊入口，不常驻大卡片挡画布；点开才是浮层式详情。
  const [collapsed, setCollapsed] = useState(detailsOpen !== true)
  const syncLabel = syncState === 'conflict'
    ? '冲突：画布已被其它端修改'
    : syncState === 'syncing'
      ? '同步中…'
      : projection
        ? `已同步 v${projection.version}`
        : '未连接'
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending')
  if (collapsed) {
    const attention = pendingReviews.length + pendingProposals.length + (pendingRuns > 0 ? 1 : 0)
    return <button type="button" className="agent-context-surface-collapsed" data-testid="agent-context-surface-collapsed" aria-label="打开 Agent 画布详情"
      onClick={() => { setCollapsed(false); onToggleDetails() }}
      title={attention > 0 ? `${attention} 项需要你的确认` : 'Agent 看到的画布'}>
      <span className={`agent-context-live ${error ? 'error' : ''}`} />
      <strong>Agent 画布</strong>
      {attention > 0 ? <em>{attention}</em> : null}
    </button>
  }
  return <aside className="agent-context-surface" data-details={detailsOpen ? 'open' : 'closed'} data-testid="agent-context-surface" aria-label="Agent 看到的画布">
    <header>
      <span className={`agent-context-live ${error ? 'error' : ''}`} />
      <div><strong>Agent 看到的画布</strong><small>{error ? '暂时无法同步' : '与当前画布同步'}</small></div>
      <code>v{projection?.version ?? 0}</code>
      <button type="button" className="icon-only pressable" onClick={() => { setCollapsed(true); onToggleDetails() }} title="收起详情" aria-label="收起详情"><ChevronUp size={13} /></button>
    </header>
    <div className={`agent-sync-badge ${syncState}`}><span>{syncLabel}</span><button type="button" className="icon-only pressable" onClick={onRefresh} title="刷新上下文">⟳</button></div>
    {runLocked && <div className="agent-run-lock" title={runLocked.id}>当前 Agent 任务已锁定 {runLocked.contextCount} 项参考内容；之后的选择只影响下一次任务。</div>}
    <dl className="agent-context-stats">
      <div><dt>选择</dt><dd>{selectedNodes.length || '无'}</dd></div>
      <div><dt>参考</dt><dd>{projection?.contextArtifacts.length ?? 0}</dd></div>
      <div><dt>任务</dt><dd>{pendingReviews.length + pendingRuns}</dd></div>
    </dl>
    <section className="agent-surface-section">
      <h4>待处理任务</h4>
      {pendingReviews.length === 0 && pendingRuns === 0
        ? <p className="agent-context-empty">暂无待办</p>
        : <>
          {pendingRuns > 0 && <p className="agent-context-empty">{pendingRuns} 条等待本地 Agent 接手</p>}
          {pendingReviews.map((review) => (
            <div key={String(review.run.id)} className="agent-review-chip" data-testid={`agent-review-${review.run.id}`}>
              <div><strong>{review.run.instruction.slice(0, 46)}</strong><small>结果待确认</small></div>
              <button type="button" className="pressable" onClick={() => onOpenReview(review)}>查看结果</button>
            </div>
          ))}
        </>}
    </section>
    {pendingProposals.length > 0 && <section className="agent-surface-section">
      <h4>Agent 建议（{pendingProposals.length}）</h4>
      {pendingProposals.map((proposal) => (
        <div key={proposal.proposalId} className="agent-proposal-chip" data-testid={`agent-proposal-${proposal.proposalId}`}>
          <div><strong>{proposal.reason}</strong><small>加入 {proposal.addViewIds.length} · 移除 {proposal.removeViewIds.length}{proposal.targetViewId ? ' · 改目标' : ''}</small></div>
          <div className="agent-proposal-actions">
            <button type="button" className="pressable" onClick={() => onAcceptProposal(proposal.proposalId)}>接受</button>
            <button type="button" className="quiet pressable" onClick={() => onRejectProposal(proposal.proposalId)}>拒绝</button>
          </div>
        </div>
      ))}
    </section>}
    {detailsOpen && <>
      <dl>
        <div><dt>项目</dt><dd>{projectLabel}</dd></div>
        <div><dt>工作空间</dt><dd>{workspaceLabel}</dd></div>
        <div><dt>当前选择</dt><dd>{selectedNodes.length || '无'}</dd></div>
        <div><dt>参考内容</dt><dd>{projection?.contextArtifacts.length ?? 0}</dd></div>
      </dl>
      {selectedNodes.length > 0
        ? <ul>{selectedNodes.slice(0, 5).map((node) => <li key={node.id}><span className={`agent-kind kind-${node.kind}`} />{node.title}</li>)}</ul>
        : <p>在画布中选择内容，Agent 会读取同一份画布选择和参考内容。</p>}
      {(projection?.offscreenClusters?.length ?? 0) > 0 && <section className="agent-surface-section">
        <h4>视口外内容</h4>
        <div className="agent-offscreen-clusters">{projection!.offscreenClusters!.slice(0, 6).map((cluster) => <span key={cluster.key} title={`${cluster.viewIds.length} 个可定位视图`}>{cluster.kind} · {cluster.count}</span>)}</div>
      </section>}
      {(projection?.recentChanges?.length ?? 0) > 0 && <section className="agent-surface-section">
        <h4>最近变化</h4>
        <ul className="agent-context-changes">{projection!.recentChanges!.slice(-4).reverse().map((change) => <li key={`${change.version}-${change.kind}-${change.occurredAt}`}><span>{change.summary}</span><small>v{change.version}</small></li>)}</ul>
      </section>}
    </>}
    {error && <div className="agent-context-error"><p>{humanizeRuntimeMessage(error)}</p><button type="button" className="quiet pressable" onClick={() => { void navigator.clipboard?.writeText(error) }}>复制诊断信息</button></div>}
  </aside>
}
