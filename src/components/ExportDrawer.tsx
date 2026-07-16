import { useState } from 'react'
import { Braces, Check, ChevronUp, Code2, FileText } from 'lucide-react'
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

function buildPayload(project: ScriptProject, version: ScriptVersion, reviews: ScriptReviewItem[], aiDrafts: AiReviewDraft[], decision: DecisionRecord) {
  const confirmed = reviews.filter((item) => item.status === 'accepted')
  return {
    project_id: project.id,
    task_type: 'commercial_script_revision',
    instruction: `根据已确认评审修改 ${version.versionLabel}`,
    context: {
      objective: project.brief.objective,
      audience: project.brief.audience,
      platform: project.brief.platform,
      creative_direction: project.creativeDirection,
      current_script_version: version.versionLabel,
      source_version_id: version.sourceVersionId ?? null,
      change_reason: version.changeReason,
      issues: confirmed.map((item) => ({ id: item.id, segment_id: item.segmentId, issue: item.issue, business_impact: item.businessImpact, evidence: item.evidenceText, suggestion: item.suggestion, decision_action: item.decisionAction })),
      keep: [...project.brief.lockedElements, ...decision.keep],
      modify: decision.modify,
      remove: decision.remove,
      next_version_goal: decision.nextVersionGoal,
      decision,
      ai_drafts: aiDrafts,
      script: version.segments,
    },
    expected_outputs: ['revised_script', 'change_summary'],
  }
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
  const payload = buildPayload(project, version, reviews, aiDrafts, decision)
  const markdown = `# ${project.title} — ${version.versionLabel} Review\n\n## Brief\n${project.brief.objective}\n\n## Creative Direction\n${project.creativeDirection.creativeMechanism}\n\n## Human Review\n${reviews.map((item) => `- **${item.issue}** (${item.status} / ${item.decisionAction})\n  - Impact: ${item.businessImpact}\n  - Evidence: ${item.evidenceText}\n  - Suggestion: ${item.suggestion}`).join('\n')}\n\n## Decision\n- Keep: ${decision.keep.join('；') || '暂无'}\n- Modify: ${decision.modify.join('；') || '暂无'}\n- Remove: ${decision.remove.join('；') || '暂无'}\n\n## Next Version Goal\n${decision.nextVersionGoal || '待确认'}`
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
