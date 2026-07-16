import { AlertTriangle, Check, Circle, Play, Sparkles } from 'lucide-react'
import type { EvaluationTab } from '../App'

const dimensions = [
  '商业目标表达',
  '平台内容适配',
  '产品融入方式',
  '构图与视觉层级',
  '动作 / 时序连续性',
  'AI 生成瑕疵',
]

interface EvaluationPanelProps {
  activeTab: EvaluationTab
  onTabChange: (tab: EvaluationTab) => void
}

export function EvaluationPanel({ activeTab, onTabChange }: EvaluationPanelProps) {
  return (
    <aside className="evaluation-panel" aria-label="评测面板">
      <div className="evaluation-tabs" role="tablist" aria-label="评测视图">
        {([
          ['human', '人工测评'],
          ['ai', 'AI 测评'],
          ['summary', '综合结论'],
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
        <div><small>当前 Recipe</small><strong>品牌商业短视频</strong></div>
        <span>3 Skills ready</span>
      </div>

      {activeTab === 'human' && (
        <div className="tab-content" role="tabpanel">
          <div className="dimension-list">
            {dimensions.map((dimension, index) => (
              <div className="dimension-row" key={dimension}>
                <span className="dimension-number">0{index + 1}</span>
                <strong>{dimension}</strong>
                <span className="empty-score">未评测</span>
                <Circle size={12} />
              </div>
            ))}
          </div>
          <div className="panel-note"><small>人工备注</small><p>Day 2 开放评分、问题标签与时间点记录。</p></div>
          <button className="secondary-action" type="button" disabled>保存人工测评</button>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="tab-content ai-empty" role="tabpanel">
          <Sparkles size={22} strokeWidth={1.5} />
          <strong>AI Skill 尚未运行</strong>
          <p>将在 Day 3 使用固定 Mock 输出展示依据与置信度。</p>
          <button className="primary-action" type="button"><Play size={15} fill="currentColor" />运行 AI 测评</button>
          <div className="skill-list"><span>commercial-context-check</span><span>visual-quality-evaluator</span><span>badcase-diagnosis</span></div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="tab-content summary-preview" role="tabpanel">
          <div><Check size={16} /><span><strong>一致</strong>等待人工与 AI 结果</span></div>
          <div><AlertTriangle size={16} /><span><strong>判断冲突</strong>不会使用平均分掩盖</span></div>
          <p>综合结论将在两侧评测完成后生成。</p>
          <button className="secondary-action" type="button" disabled>生成综合结论</button>
        </div>
      )}
    </aside>
  )
}
