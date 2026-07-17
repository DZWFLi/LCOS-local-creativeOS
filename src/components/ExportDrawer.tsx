import { useState } from 'react'
import { Braces, Check, ChevronUp, Code2, FileText } from 'lucide-react'
import { buildHandoffPayload, buildReviewMarkdown } from '../services/reviewExports'
import type { AiReviewDraft, DecisionRecord, ScriptProject, ScriptReviewItem, ScriptVersion } from '../types/evaluation'

interface ExportDrawerProps {
  open: boolean
  project: ScriptProject
  version: ScriptVersion
  reviews: ScriptReviewItem[]
  aiDrafts: AiReviewDraft[]
  decision: DecisionRecord
  onToggle: () => void
}

function download(name: string, content: string, type: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

export function ExportDrawer({ open, project, version, reviews, aiDrafts, decision, onToggle }: ExportDrawerProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const payload = buildHandoffPayload(project, version, reviews, aiDrafts, decision)
  const markdown = buildReviewMarkdown(project, version, reviews, decision)
  const fileStem = `${project.id}-${version.id}`

  const copyHandoff = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); setCopyState('copied') } catch { setCopyState('failed') }
  }

  return <section className={`export-drawer${open ? ' is-open' : ''}`}>
    <button className="drawer-handle" type="button" onClick={onToggle}><span>Context / Export</span><ChevronUp className={open ? 'is-rotated' : ''} size={16} /></button>
    <div className="drawer-content export-grid">
      <button onClick={() => download(`${fileStem}-review.md`, markdown, 'text/markdown;charset=utf-8')} type="button"><FileText size={18} /><span><strong>Markdown Review</strong><small>Brief、人工判断与修改任务</small></span></button>
      <button onClick={() => download(`${fileStem}-handoff.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')} type="button"><Braces size={18} /><span><strong>JSON</strong><small>结构化项目上下文</small></span></button>
      <button onClick={copyHandoff} type="button">{copyState === 'copied' ? <Check size={18} /> : <Code2 size={18} />}<span><strong>{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy Failed' : 'Codex Handoff'}</strong><small>复制 commercial_script_revision 任务</small></span></button>
    </div>
  </section>
}
