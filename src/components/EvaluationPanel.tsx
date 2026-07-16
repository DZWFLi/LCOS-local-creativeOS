import { useState } from 'react'
import { AlertTriangle, Check, Plus, Sparkles, X } from 'lucide-react'
import type { EvaluationTab } from '../App'
import type { AiReviewDraft, DecisionAction, DecisionRecord, ReviewStatus, ScriptReviewItem, ScriptSegment } from '../types/evaluation'

const statusFlow: Record<ReviewStatus, ReviewStatus> = { open: 'accepted', accepted: 'resolved', resolved: 'open', rejected: 'open' }

interface EvaluationPanelProps {
  activeTab: EvaluationTab
  aiDraft: AiReviewDraft
  decision: DecisionRecord
  reviews: ScriptReviewItem[]
  segment: ScriptSegment
  versionId: string
  onAiDraftChange: (draft: AiReviewDraft) => void
  onDecisionChange: (decision: DecisionRecord) => void
  onReviewsChange: (reviews: ScriptReviewItem[]) => void
  onTabChange: (tab: EvaluationTab) => void
}

export function EvaluationPanel({ activeTab, aiDraft, decision, reviews, segment, versionId, onAiDraftChange, onDecisionChange, onReviewsChange, onTabChange }: EvaluationPanelProps) {
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'segment' | 'all'>('segment')
  const [draft, setDraft] = useState({ issue: '', businessImpact: '', evidenceText: '', suggestion: '' })
  const versionReviews = reviews.filter((review) => review.versionId === versionId)
  const visibleReviews = filter === 'all' ? versionReviews : versionReviews.filter((review) => review.segmentId === segment.id)

  const patchReview = (id: string, patch: Partial<ScriptReviewItem>) => {
    onReviewsChange(reviews.map((review) => review.id === id ? { ...review, ...patch } : review))
  }

  const createReview = () => {
    if (!draft.issue.trim()) return
    onReviewsChange([...reviews, {
      id: `review-${Date.now()}`,
      versionId,
      segmentId: segment.id,
      category: 'Human Creative Review',
      issue: draft.issue,
      businessImpact: draft.businessImpact,
      evidenceText: draft.evidenceText || `${segment.timeStart}–${segment.timeEnd}s · ${segment.beatName}`,
      suggestion: draft.suggestion,
      authorType: 'human',
      status: 'open',
      decisionAction: 'modify',
    }])
    setDraft({ issue: '', businessImpact: '', evidenceText: '', suggestion: '' })
    setCreating(false)
  }

  const decideAi = (disposition: AiReviewDraft['disposition']) => {
    onAiDraftChange({ ...aiDraft, disposition, updatedAt: new Date().toISOString() })
  }

  return (
    <aside className="evaluation-panel" aria-label="脚本评审面板">
      <div className="evaluation-tabs" role="tablist">
        {([['human', '人工判断'], ['ai', 'AI 分析'], ['summary', 'Decision']] as const).map(([id, label]) => (
          <button className={activeTab === id ? 'is-active' : ''} key={id} onClick={() => onTabChange(id)} role="tab" type="button">{label}</button>
        ))}
      </div>
      <div className="recipe-row"><div><small>Review Recipe</small><strong>品牌产品短片</strong></div><span>{segment.timeStart}–{segment.timeEnd}s · {segment.beatName}</span></div>

      {activeTab === 'human' && <div className="review-panel-body" role="tabpanel">
        <div className="review-toolbar">
          <button className={filter === 'segment' ? 'is-active' : ''} onClick={() => setFilter('segment')} type="button">当前段落</button>
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')} type="button">全部问题</button>
          <button className="add-review" onClick={() => setCreating(true)} type="button"><Plus size={12} />新建</button>
        </div>
        {creating && <div className="new-review-form">
          <header><strong>New Creative Review</strong><button onClick={() => setCreating(false)} type="button"><X size={13} /></button></header>
          <label>Issue<textarea value={draft.issue} onChange={(event) => setDraft({ ...draft, issue: event.target.value })} /></label>
          <label>Business Impact<textarea value={draft.businessImpact} onChange={(event) => setDraft({ ...draft, businessImpact: event.target.value })} /></label>
          <label>Evidence<textarea value={draft.evidenceText} placeholder={`${segment.timeStart}–${segment.timeEnd}s · 对应文本证据`} onChange={(event) => setDraft({ ...draft, evidenceText: event.target.value })} /></label>
          <label>Suggestion<textarea value={draft.suggestion} onChange={(event) => setDraft({ ...draft, suggestion: event.target.value })} /></label>
          <button className="primary-action" onClick={createReview} type="button">保存 Review</button>
        </div>}
        <div className="review-list">
          {visibleReviews.map((review) => <article className={`review-card status-${review.status}`} key={review.id}>
            <header><span>{review.category} · {review.authorType.toUpperCase()}</span><button onClick={() => patchReview(review.id, { status: statusFlow[review.status] })} type="button">{review.status}</button></header>
            <strong>{review.issue}</strong>
            <dl><div><dt>Impact</dt><dd>{review.businessImpact}</dd></div><div><dt>Evidence</dt><dd>{review.evidenceText}</dd></div><div><dt>Suggestion</dt><dd>{review.suggestion}</dd></div></dl>
            <footer><span>Decision</span>{(['keep', 'modify', 'remove'] as DecisionAction[]).map((action) => <button className={review.decisionAction === action ? 'is-active' : ''} key={action} onClick={() => patchReview(review.id, { decisionAction: action })} type="button">{action}</button>)}</footer>
          </article>)}
          {visibleReviews.length === 0 && <p className="empty-state">当前段落还没有评审问题。</p>}
        </div>
      </div>}

      {activeTab === 'ai' && <div className="ai-review-panel" role="tabpanel">
        <div className="ai-status"><Sparkles size={16} /><span><strong>Mock Skill Analysis</strong><small>Confidence · {aiDraft.confidence}</small></span><em>{aiDraft.disposition}</em></div>
        {aiDraft.findings.map((finding) => <div className="skill-finding" key={finding.skill}><strong>{finding.skill}</strong><p>{finding.finding}</p></div>)}
        <label className="ai-copy"><span>AI Original</span><textarea readOnly value={aiDraft.originalText} /></label>
        <label className="ai-copy"><span>Human Revision</span><textarea value={aiDraft.humanRevision} onChange={(event) => onAiDraftChange({ ...aiDraft, humanRevision: event.target.value })} /></label>
        <div className="ai-actions"><button onClick={() => decideAi('accepted')} type="button">Accept</button><button onClick={() => decideAi('revised')} type="button">Revise</button><button onClick={() => decideAi('rejected')} type="button">Reject</button></div>
      </div>}

      {activeTab === 'summary' && <div className="decision-panel" role="tabpanel">
        <div><Check size={15} /><span><strong>Keep</strong>{decision.keep.join('；') || '暂无'}</span></div>
        <div><AlertTriangle size={15} /><span><strong>Modify</strong>{decision.modify.join('；') || '暂无'}</span></div>
        <div><X size={15} /><span><strong>Remove</strong>{decision.remove.join('；') || '暂无'}</span></div>
        <label>下一版目标<textarea value={decision.nextVersionGoal} onChange={(event) => onDecisionChange({ ...decision, nextVersionGoal: event.target.value })} /></label>
      </div>}
    </aside>
  )
}
