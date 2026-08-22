import { ChevronUp, CircleDot, PackageOpen, Pin } from 'lucide-react'
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
  receiver,
  onAcceptProposal,
  onRejectProposal,
  onModifyProposal,
  onRefresh,
  onToggleDetails,
  onOpenReview,
  onHandoff,
}: {
  readonly projectLabel: string
  readonly workspaceLabel: string
  readonly projection: ActiveContextProjection | null
  readonly selectedNodes: readonly CanvasNode[]
  readonly error: string | null
  readonly syncState: 'syncing' | 'synced' | 'recovering' | 'uncertain' | 'conflict' | 'offline'
  readonly proposals: readonly ContextChangeProposalV1[]
  readonly pendingRuns: number
  readonly pendingReviews: readonly RunReview[]
  readonly detailsOpen: boolean
  readonly runLocked: { readonly id: string; readonly contextCount: number } | null
  readonly receiver?: { readonly provider: 'codex' | 'workbuddy'; readonly externalSessionId: string; readonly status: 'active' | 'stale' | 'closed'; readonly lastSeenAt: string }
  readonly onAcceptProposal: (proposalId: string) => void
  readonly onRejectProposal: (proposalId: string) => void
  readonly onModifyProposal: (proposal: ContextChangeProposalV1, instruction: string) => void
  readonly onRefresh: () => void
  readonly onToggleDetails: () => void
  readonly onOpenReview: (review: RunReview) => void
  readonly onHandoff: () => void
}) {
  const [collapsed, setCollapsed] = useState(detailsOpen !== true)
  const [modifyingProposalId, setModifyingProposalId] = useState<string | null>(null)
  const [modifyInstruction, setModifyInstruction] = useState('')
  const syncLabel = syncState === 'conflict'
    ? '检测到真正冲突'
    : syncState === 'syncing'
      ? '同步中…'
      : syncState === 'recovering'
        ? '正在恢复连接'
        : syncState === 'uncertain'
          ? '保存状态待确认'
          : syncState === 'offline'
            ? '本地核心暂时不可用'
            : projection
              ? `已同步 v${projection.version}`
              : '未连接'
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending')
  const attention = pendingReviews.length + pendingProposals.length + (pendingRuns > 0 ? 1 : 0)

  if (collapsed) {
    return <button type="button" className="agent-context-surface-collapsed" data-testid="agent-context-surface-collapsed" aria-label="打开协作上下文"
      onClick={() => { setCollapsed(false); onToggleDetails() }}
      title={attention > 0 ? `${attention} 项需要你的确认` : '协作上下文'}>
      <span className={`agent-context-live ${error ? 'error' : ''}`} />
      <strong>协作</strong>
      {attention > 0 ? <em>{attention}</em> : null}
    </button>
  }

  return <aside className="agent-context-surface" data-details={detailsOpen ? 'open' : 'closed'} data-testid="agent-context-surface" aria-label="协作上下文">
    <header>
      <span className={`agent-context-live ${error ? 'error' : ''}`} />
      <div><strong>协作上下文</strong><small>{error ? '部分状态暂不可用' : '只显示当前项目状态与待确认结果'}</small></div>
      <code>v{projection?.version ?? 0}</code>
      <button type="button" className="icon-only pressable" onClick={() => { setCollapsed(true); onToggleDetails() }} title="收起" aria-label="收起"><ChevronUp size={13}/></button>
    </header>
    <div className={`agent-sync-badge ${syncState}`}><span>{syncLabel}</span><button type="button" className="icon-only pressable" onClick={onRefresh} title="刷新上下文">⟳</button></div>
    <section className="agent-receiver-chip" data-receiver-status={receiver?.status ?? 'unavailable'}>
      <span><i/><strong>{receiver ? `${receiver.provider} · ${receiver.status === 'active' ? '当前接收端' : '最近接收端'}` : '未连接 Receiver'}</strong><small>{receiver ? receiver.externalSessionId : '当前 Runtime 没有可切换的 Provider Session'}</small></span>
      <button type="button" className="quiet pressable" onClick={onHandoff}><PackageOpen size={12}/>一次性交接</button>
    </section>
    {runLocked && <div className="agent-run-lock" title={runLocked.id}>当前任务已锁定 {runLocked.contextCount} 项参考；之后的选择只影响下一次任务。</div>}
    <dl className="agent-context-stats">
      <div><dt><CircleDot size={10}/>选择</dt><dd>{selectedNodes.length || '无'}</dd></div>
      <div><dt><Pin size={10}/>参考</dt><dd>{projection?.contextArtifacts.length ?? 0}</dd></div>
      <div><dt>待确认</dt><dd>{pendingReviews.length + pendingProposals.length + pendingRuns}</dd></div>
    </dl>

    {(pendingReviews.length > 0 || pendingRuns > 0) && <section className="agent-surface-section">
      <h4>待处理结果</h4>
      {pendingRuns > 0 && <p className="agent-context-empty">{pendingRuns} 条任务等待本地 Agent 接手</p>}
      {pendingReviews.slice(0, 4).map((review) => (
        <div key={String(review.run.id)} className="agent-review-chip" data-testid={`agent-review-${review.run.id}`}>
          <div><strong>{review.run.instruction.slice(0, 46)}</strong><small>结果待确认</small></div>
          <button type="button" className="pressable" onClick={() => onOpenReview(review)}>查看</button>
        </div>
      ))}
    </section>}

    {pendingProposals.length > 0 && <section className="agent-surface-section">
      <h4>Agent 修改建议（{pendingProposals.length}）</h4>
      {pendingProposals.slice(0, 4).map((proposal) => (
        <div key={proposal.proposalId} className="agent-proposal-chip" data-testid={`agent-proposal-${proposal.proposalId}`}>
          <div><strong>{proposal.reason}</strong><small>加入 {proposal.addViewIds.length} · 移除 {proposal.removeViewIds.length}{proposal.targetViewId ? ' · 改目标' : ''}</small></div>
          <div className="agent-proposal-actions">
            <button type="button" className="pressable" onClick={() => onAcceptProposal(proposal.proposalId)}>保留</button>
            <button type="button" className="quiet pressable" onClick={() => { setModifyingProposalId(proposal.proposalId); setModifyInstruction('') }}>修改</button>
            <button type="button" className="quiet pressable" onClick={() => onRejectProposal(proposal.proposalId)}>撤掉</button>
          </div>
          {modifyingProposalId === proposal.proposalId && <div className="agent-proposal-modify">
            <input value={modifyInstruction} onChange={(event) => setModifyInstruction(event.target.value)} placeholder="告诉 Agent 这一版要怎么改" autoFocus onKeyDown={(event) => {
              if (event.key === 'Escape') { setModifyingProposalId(null); setModifyInstruction('') }
              if (event.key === 'Enter' && modifyInstruction.trim()) { onModifyProposal(proposal, modifyInstruction.trim()); setModifyingProposalId(null); setModifyInstruction('') }
            }}/>
            <button type="button" className="pressable" disabled={!modifyInstruction.trim()} onClick={() => { onModifyProposal(proposal, modifyInstruction.trim()); setModifyingProposalId(null); setModifyInstruction('') }}>让 Agent 改</button>
          </div>}
        </div>
      ))}
    </section>}

    {detailsOpen && <>
      <dl>
        <div><dt>项目</dt><dd>{projectLabel}</dd></div>
        <div><dt>现场</dt><dd>{workspaceLabel}</dd></div>
      </dl>
      {selectedNodes.length > 0 && <section className="agent-surface-section"><h4>当前选择</h4><ul>{selectedNodes.slice(0, 5).map((node) => <li key={node.id}>{node.title}</li>)}</ul></section>}
      {(projection?.contextArtifacts.length ?? 0) > 0 && <section className="agent-surface-section"><h4>当前参考</h4><ul>{projection!.contextArtifacts.slice(0, 5).map((item) => <li key={item.viewId}>{item.title}</li>)}</ul></section>}
      {(projection?.recentChanges?.length ?? 0) > 0 && <section className="agent-surface-section">
        <h4>最近变化</h4>
        <ul className="agent-context-changes">{projection!.recentChanges!.filter((change) => change.kind !== 'viewport').slice(-4).reverse().map((change) => <li key={`${change.version}-${change.kind}-${change.occurredAt}`}><span>{change.summary}</span><small>v{change.version}</small></li>)}</ul>
      </section>}
    </>}
    {error && <div className="agent-context-error"><p>{humanizeRuntimeMessage(error)}</p><button type="button" className="quiet pressable" onClick={() => { void navigator.clipboard?.writeText(error) }}>复制诊断信息</button></div>}
  </aside>
}
