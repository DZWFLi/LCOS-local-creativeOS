import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EvaluationPanel } from './components/EvaluationPanel'
import { ExportDrawer } from './components/ExportDrawer'
import { ScriptCanvas } from './components/ScriptCanvas'
import { ScriptRail } from './components/ScriptRail'
import { scriptProject } from './data/scriptProject'
import { demoStorage } from './infrastructure/demoStorage'
import type { AiReviewDraft, DecisionRecord, ScriptReviewItem, ScriptSegment, ScriptVersion } from './types/evaluation'
import './App.css'

export type EvaluationTab = 'human' | 'ai' | 'summary'

function emptyDecision(versionId: string): DecisionRecord {
  return { id: `decision-${versionId}`, versionId, acceptedIssues: [], rejectedIssues: [], keep: [], modify: [], remove: [], nextVersionGoal: '', unresolvedQuestions: [], decisionSource: 'ai-assisted', createdAt: new Date().toISOString() }
}

function App() {
  const [initialState] = useState(() => demoStorage.load(scriptProject.id))
  const [versions, setVersions] = useState<ScriptVersion[]>(initialState.versions)
  const [reviews, setReviews] = useState<ScriptReviewItem[]>(initialState.reviews)
  const [aiDrafts, setAiDrafts] = useState<AiReviewDraft[]>(initialState.aiDrafts)
  const [decisions, setDecisions] = useState<DecisionRecord[]>(initialState.decisions)
  const [selectedVersionId, setSelectedVersionId] = useState(initialState.ui.selectedVersionId)
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialState.ui.selectedSegmentId)
  const [activeTab, setActiveTab] = useState<EvaluationTab>(initialState.ui.activeTab)
  const [contextOpen, setContextOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const version = versions.find((item) => item.id === selectedVersionId) ?? versions[0]
  const segment = version.segments.find((item) => item.id === selectedSegmentId) ?? version.segments[0]
  const sourceVersion = versions.find((item) => item.id === version.sourceVersionId)
  const baselineSegment = sourceVersion?.segments.find((item) => item.id === segment.id)
  const aiDraft = aiDrafts.find((item) => item.versionId === version.id && item.segmentId === segment.id)
    ?? { versionId: version.id, segmentId: segment.id, findings: [{ skill: 'Brief Alignment', finding: '该版本尚未运行 Mock Skill 分析。' }], originalText: '等待当前版本的分析草稿。', humanRevision: '', disposition: 'pending' as const, confidence: 'medium' as const, updatedAt: null }
  const versionReviews = useMemo(() => reviews.filter((item) => item.versionId === version.id), [reviews, version.id])
  const decision = decisions.find((item) => item.versionId === version.id) ?? emptyDecision(version.id)

  useEffect(() => demoStorage.save(scriptProject.id, { versions, reviews, aiDrafts, decisions, ui: { selectedVersionId, selectedSegmentId, activeTab } }), [versions, reviews, aiDrafts, decisions, selectedVersionId, selectedSegmentId, activeTab])

  const resetDemo = () => {
    const reset = demoStorage.reset(scriptProject.id)
    setVersions(reset.versions)
    setReviews(reset.reviews)
    setAiDrafts(reset.aiDrafts)
    setDecisions(reset.decisions)
    setSelectedVersionId(reset.ui.selectedVersionId)
    setSelectedSegmentId(reset.ui.selectedSegmentId)
    setActiveTab(reset.ui.activeTab)
    setContextOpen(false)
    setDrawerOpen(false)
    setCompareOpen(false)
    setResetConfirmOpen(false)
  }

  const selectVersion = (id: string) => {
    setSelectedVersionId(id)
    const next = versions.find((item) => item.id === id)
    if (next && !next.segments.some((item) => item.id === selectedSegmentId)) setSelectedSegmentId(next.segments[0].id)
  }

  const changeSegment = (nextSegment: ScriptSegment) => {
    setVersions((current) => current.map((item) => item.id === version.id
      ? { ...item, segments: item.segments.map((candidate) => candidate.id === nextSegment.id ? nextSegment : candidate) }
      : item))
  }

  const changeAiDraft = (next: AiReviewDraft) => setAiDrafts((current) => {
    const exists = current.some((item) => item.versionId === next.versionId && item.segmentId === next.segmentId)
    return exists ? current.map((item) => item.versionId === next.versionId && item.segmentId === next.segmentId ? next : item) : [...current, next]
  })

  const changeReviews = (nextReviews: ScriptReviewItem[]) => {
    setReviews(nextReviews)
    const scoped = nextReviews.filter((item) => item.versionId === version.id)
    const nextDecision = {
      ...decision,
      acceptedIssues: scoped.filter((item) => item.status === 'accepted').map((item) => item.issue),
      rejectedIssues: scoped.filter((item) => item.status === 'rejected').map((item) => item.issue),
      keep: scoped.filter((item) => item.decisionAction === 'keep').map((item) => item.suggestion || item.issue),
      modify: scoped.filter((item) => item.decisionAction === 'modify').map((item) => item.suggestion || item.issue),
      remove: scoped.filter((item) => item.decisionAction === 'remove').map((item) => item.issue),
    }
    setDecisions((current) => current.some((item) => item.versionId === version.id)
      ? current.map((item) => item.versionId === version.id ? nextDecision : item)
      : [...current, nextDecision])
  }

  const changeDecision = (next: DecisionRecord) => setDecisions((current) => current.some((item) => item.versionId === next.versionId)
    ? current.map((item) => item.versionId === next.versionId ? next : item)
    : [...current, next])

  return <div className="app-shell">
    <header className="topbar"><div className="brand">AdFrame <span>Script</span></div><div className="topbar-divider" /><div className="current-project">{scriptProject.title}</div><button className="reset-demo" onClick={() => setResetConfirmOpen(true)} type="button"><RotateCcw size={13} />恢复演示数据</button><div className="topbar-status"><span className="status-dot" />V0 · Script Review</div></header>
    <main className="workspace script-workspace">
      <ScriptRail versions={versions} selectedVersionId={version.id} selectedSegmentId={segment.id} onSelectVersion={selectVersion} onSelectSegment={setSelectedSegmentId} />
      <ScriptCanvas baselineSegment={baselineSegment} brief={scriptProject.brief} creativeDirection={scriptProject.creativeDirection} compareOpen={compareOpen} contextOpen={contextOpen} reviews={versionReviews} segments={version.segments} selectedSegmentId={segment.id} sourceVersionLabel={sourceVersion?.versionLabel} onChangeSegment={changeSegment} onSelectSegment={setSelectedSegmentId} onToggleCompare={() => setCompareOpen((open) => !open)} onToggleContext={() => setContextOpen((open) => !open)} />
      <EvaluationPanel activeTab={activeTab} aiDraft={aiDraft} decision={decision} reviews={reviews} segment={segment} versionId={version.id} onAiDraftChange={changeAiDraft} onDecisionChange={changeDecision} onReviewsChange={changeReviews} onTabChange={setActiveTab} />
    </main>
    <ExportDrawer open={drawerOpen} decision={decision} project={{ ...scriptProject, versions }} version={version} reviews={versionReviews} aiDrafts={aiDrafts.filter((item) => item.versionId === version.id)} onToggle={() => setDrawerOpen((open) => !open)} />
    {resetConfirmOpen && <div className="reset-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setResetConfirmOpen(false) }}>
      <section aria-labelledby="reset-title" aria-modal="true" className="reset-dialog" role="dialog">
        <small>DEMO RESET</small>
        <h2 id="reset-title">恢复预设演示数据？</h2>
        <p>当前脚本编辑、评审状态和 AI 处置将被清除，并回到 Script V2 / Product Setup。</p>
        <div><button onClick={() => setResetConfirmOpen(false)} type="button">取消</button><button className="confirm-reset" onClick={resetDemo} type="button">确认恢复</button></div>
      </section>
    </div>}
  </div>
}

export default App
