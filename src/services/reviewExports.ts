import { DEMO_SCHEMA_VERSION } from '../demo/seed'
import type { AiReviewDraft, DecisionRecord, ScriptProject, ScriptReviewItem, ScriptVersion } from '../types/evaluation'

export function buildHandoffPayload(project: ScriptProject, version: ScriptVersion, reviews: ScriptReviewItem[], aiDrafts: AiReviewDraft[], decision: DecisionRecord) {
  const confirmed = reviews.filter((item) => item.status === 'accepted')
  return {
    schema_version: DEMO_SCHEMA_VERSION,
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

export function buildReviewMarkdown(project: ScriptProject, version: ScriptVersion, reviews: ScriptReviewItem[], decision: DecisionRecord): string {
  return `# ${project.title} — ${version.versionLabel} Review\n\n## Brief\n${project.brief.objective}\n\n## Creative Direction\n${project.creativeDirection.creativeMechanism}\n\n## Human Review\n${reviews.map((item) => `- **${item.issue}** (${item.status} / ${item.decisionAction})\n  - Impact: ${item.businessImpact}\n  - Evidence: ${item.evidenceText}\n  - Suggestion: ${item.suggestion}`).join('\n')}\n\n## Decision\n- Keep: ${decision.keep.join('；') || '暂无'}\n- Modify: ${decision.modify.join('；') || '暂无'}\n- Remove: ${decision.remove.join('；') || '暂无'}\n\n## Next Version Goal\n${decision.nextVersionGoal || '待确认'}`
}
