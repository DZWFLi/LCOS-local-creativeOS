import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Play, Sparkles } from 'lucide-react'
import type { EvaluationTab } from '../App'
import { creativeReviewDimensions, initialCreativeReviews } from '../data/creativeReviews'
import type { CreativeReviewItem, CreativeReviewStatus } from '../types/evaluation'

const STORAGE_KEY = 'adframe.creative-reviews.v1'

const statusLabels: Record<CreativeReviewStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  resolved: 'Resolved',
}

const nextStatus: Record<CreativeReviewStatus, CreativeReviewStatus> = {
  open: 'accepted',
  accepted: 'resolved',
  resolved: 'open',
}

function loadReviews() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as CreativeReviewItem[]) : initialCreativeReviews
  } catch {
    return initialCreativeReviews
  }
}

interface EvaluationPanelProps {
  activeTab: EvaluationTab
  assetId: string
  onTabChange: (tab: EvaluationTab) => void
}

export function EvaluationPanel({ activeTab, assetId, onTabChange }: EvaluationPanelProps) {
  const [reviews, setReviews] = useState<CreativeReviewItem[]>(loadReviews)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  }, [reviews])

  const assetReviews = useMemo(
    () => reviews.filter((review) => review.assetId === assetId),
    [assetId, reviews],
  )

  const updateStatus = (id: string) => {
    setReviews((current) => current.map((review) => (
      review.id === id ? { ...review, status: nextStatus[review.status] } : review
    )))
  }

  return (
    <aside className="evaluation-panel" aria-label="创意评审面板">
      <div className="evaluation-tabs" role="tablist" aria-label="评审视图">
        {([
          ['human', '创意判断'],
          ['ai', 'AI 分析'],
          ['summary', '综合决策'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'is-active' : ''}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="recipe-row">
        <div><small>Creative Review Recipe</small><strong>品牌商业短视频</strong></div>
        <span>{assetReviews.length} Issues</span>
      </div>

      {activeTab === 'human' && (
        <div className="tab-content creative-review-content" role="tabpanel">
          <div className="review-dimensions" aria-label="评审维度">
            {creativeReviewDimensions.map((dimension, index) => (
              <span key={dimension.id}><i>0{index + 1}</i>{dimension.label}</span>
            ))}
          </div>

          <div className="review-list">
            {assetReviews.map((review) => {
              const category = creativeReviewDimensions.find((item) => item.id === review.category)
              return (
                <article className={`review-card status-${review.status}`} key={review.id}>
                  <header>
                    <span>{category?.en}</span>
                    <button type="button" onClick={() => updateStatus(review.id)}>
                      {statusLabels[review.status]} <ChevronRight size={11} />
                    </button>
                  </header>
                  <strong>{review.issue}</strong>
                  <dl>
                    <div><dt>Impact</dt><dd>{review.impact}</dd></div>
                    <div><dt>Evidence</dt><dd>{review.evidence}</dd></div>
                    <div><dt>Suggestion</dt><dd>{review.suggestion}</dd></div>
                  </dl>
                </article>
              )
            })}
          </div>
          <p className="persistence-note">状态会保存在当前浏览器；点击状态可推进 Open → Accepted → Resolved。</p>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="tab-content ai-empty" role="tabpanel">
          <Sparkles size={22} strokeWidth={1.5} />
          <strong>AI 分析尚未运行</strong>
          <p>AI 将生成初稿分析与证据，不替代创意判断，也不输出虚假评分。</p>
          <button className="primary-action" type="button"><Play size={15} fill="currentColor" />生成分析初稿</button>
          <div className="skill-list"><span>concept-fit-review</span><span>commercial-context-check</span><span>badcase-diagnosis</span></div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="tab-content summary-preview" role="tabpanel">
          <div><Check size={16} /><span><strong>保持</strong>石膏像角色设定与产品揭示结构</span></div>
          <div><AlertTriangle size={16} /><span><strong>修改</strong>热感铺垫与安装动作因果</span></div>
          <p>综合决策将在创意判断与 AI 分析完成后生成。</p>
          <button className="secondary-action" type="button" disabled>生成综合决策</button>
        </div>
      )}
    </aside>
  )
}
