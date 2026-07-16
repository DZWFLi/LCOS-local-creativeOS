import { useEffect, useMemo, useState } from 'react'
import { EvaluationPanel } from './components/EvaluationPanel'
import { ExportDrawer } from './components/ExportDrawer'
import { ScriptCanvas } from './components/ScriptCanvas'
import { ScriptRail } from './components/ScriptRail'
import { initialAiDrafts, initialScriptReviews, scriptProject } from './data/scriptProject'
import type { AiReviewDraft, ScriptReviewItem, ScriptSegment, ScriptVersion } from './types/evaluation'
import './App.css'

export type EvaluationTab = 'human' | 'ai' | 'summary'

const SCRIPT_KEY = 'adframe.script-versions.v1'
const REVIEW_KEY = 'adframe.script-reviews.v1'
const AI_KEY = 'adframe.script-ai-drafts.v1'

function loadStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function App() {
  const [versions, setVersions] = useState<ScriptVersion[]>(() => loadStored(SCRIPT_KEY, scriptProject.versions))
  const [reviews, setReviews] = useState<ScriptReviewItem[]>(() => loadStored(REVIEW_KEY, initialScriptReviews))
  const [aiDrafts, setAiDrafts] = useState<AiReviewDraft[]>(() => loadStored(AI_KEY, initialAiDrafts))
  const [selectedVersionId, setSelectedVersionId] = useState('script-v3')
  const [selectedSegmentId, setSelectedSegmentId] = useState('heat-setup')
  const [activeTab, setActiveTab] = useState<EvaluationTab>('human')
  const [contextOpen, setContextOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  const version = versions.find((item) => item.id === selectedVersionId) ?? versions[0]
  const segment = version.segments.find((item) => item.id === selectedSegmentId) ?? version.segments[0]
  const baselineSegment = versions[0].segments.find((item) => item.id === segment.id) ?? versions[0].segments[0]
  const aiDraft = aiDrafts.find((item) => item.segmentId === segment.id) ?? aiDrafts[0]
  const versionReviews = useMemo(() => reviews.filter((item) => item.versionId === version.id), [reviews, version.id])

  useEffect(() => localStorage.setItem(SCRIPT_KEY, JSON.stringify(versions)), [versions])
  useEffect(() => localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews)), [reviews])
  useEffect(() => localStorage.setItem(AI_KEY, JSON.stringify(aiDrafts)), [aiDrafts])

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

  const changeAiDraft = (next: AiReviewDraft) => setAiDrafts((current) => current.map((item) => item.segmentId === next.segmentId ? next : item))

  return <div className="app-shell">
    <header className="topbar"><div className="brand">AdFrame <span>Script</span></div><div className="topbar-divider" /><div className="current-project">{scriptProject.title}</div><div className="topbar-status"><span className="status-dot" />V0 · Script Review</div></header>
    <main className="workspace script-workspace">
      <ScriptRail versions={versions} selectedVersionId={version.id} selectedSegmentId={segment.id} onSelectVersion={selectVersion} onSelectSegment={setSelectedSegmentId} />
      <ScriptCanvas baselineSegment={baselineSegment} brief={scriptProject.brief} compareOpen={compareOpen} contextOpen={contextOpen} reviews={versionReviews} segments={version.segments} selectedSegmentId={segment.id} onChangeSegment={changeSegment} onSelectSegment={setSelectedSegmentId} onToggleCompare={() => setCompareOpen((open) => !open)} onToggleContext={() => setContextOpen((open) => !open)} />
      <EvaluationPanel activeTab={activeTab} aiDraft={aiDraft} reviews={reviews} segment={segment} versionId={version.id} onAiDraftChange={changeAiDraft} onReviewsChange={setReviews} onTabChange={setActiveTab} />
    </main>
    <ExportDrawer open={drawerOpen} project={{ ...scriptProject, versions }} version={version} reviews={versionReviews} aiDrafts={aiDrafts} onToggle={() => setDrawerOpen((open) => !open)} />
  </div>
}

export default App
