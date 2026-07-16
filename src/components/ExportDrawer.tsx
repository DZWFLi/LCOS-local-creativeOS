import { Braces, ChevronUp, Code2, FileText } from 'lucide-react'
import type { AiReviewDraft, ScriptProject, ScriptReviewItem, ScriptVersion } from '../types/evaluation'

interface ExportDrawerProps {
  open: boolean
  project: ScriptProject
  version: ScriptVersion
  reviews: ScriptReviewItem[]
  aiDrafts: AiReviewDraft[]
  onToggle: () => void
}

function buildPayload(project: ScriptProject, version: ScriptVersion, reviews: ScriptReviewItem[], aiDrafts: AiReviewDraft[]) {
  return {
    project_id: project.id,
    task_type: 'commercial_script_revision',
    instruction: `根据已确认评审修改 ${version.label}`,
    context: {
      objective: project.brief.objective,
      audience: project.brief.audience,
      platform: project.brief.platform,
      current_script_version: version.label,
      issues: reviews.filter((item) => item.status !== 'resolved').map((item) => item.issue),
      keep: [...project.brief.lockedElements, ...reviews.filter((item) => item.decisionAction === 'keep').map((item) => item.suggestion)],
      modify: reviews.filter((item) => item.decisionAction === 'modify').map((item) => item.suggestion),
      remove: reviews.filter((item) => item.decisionAction === 'remove').map((item) => item.issue),
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

export function ExportDrawer({ open, project, version, reviews, aiDrafts, onToggle }: ExportDrawerProps) {
  const payload = buildPayload(project, version, reviews, aiDrafts)
  const markdown = `# ${project.title} — ${version.label} Review\n\n## Brief\n${project.brief.objective}\n\n## Human Review\n${reviews.map((item) => `- **${item.issue}** (${item.status} / ${item.decisionAction})\n  - Impact: ${item.impact}\n  - Suggestion: ${item.suggestion}`).join('\n')}\n\n## Next Test Goal\n${payload.context.modify.join('；')}`

  return <section className={`export-drawer${open ? ' is-open' : ''}`}>
    <button className="drawer-handle" type="button" onClick={onToggle}><span>Context / Export</span><ChevronUp className={open ? 'is-rotated' : ''} size={16} /></button>
    <div className="drawer-content export-grid">
      <button onClick={() => download('adframe-script-review.md', markdown, 'text/markdown')} type="button"><FileText size={18} /><span><strong>Markdown Review</strong><small>Brief、人工判断与修改任务</small></span></button>
      <button onClick={() => download('adframe-script-review.json', JSON.stringify(payload, null, 2), 'application/json')} type="button"><Braces size={18} /><span><strong>JSON</strong><small>结构化项目上下文</small></span></button>
      <button onClick={() => navigator.clipboard.writeText(JSON.stringify(payload, null, 2))} type="button"><Code2 size={18} /><span><strong>Codex Handoff</strong><small>复制 commercial_script_revision 任务</small></span></button>
    </div>
  </section>
}
