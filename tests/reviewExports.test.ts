import { describe, expect, it } from 'vitest'
import { initialAiDrafts, initialDecisions, initialScriptReviews, scriptProject } from '../src/data/scriptProject'
import { buildHandoffPayload, buildReviewMarkdown } from '../src/services/reviewExports'

describe('review export builders', () => {
  const version = scriptProject.versions.find((item) => item.id === 'script-v2') ?? scriptProject.versions[0]
  const reviews = initialScriptReviews.filter((item) => item.versionId === version.id)
  const drafts = initialAiDrafts.filter((item) => item.versionId === version.id)
  const decision = initialDecisions.find((item) => item.versionId === version.id) ?? initialDecisions[0]

  it('only sends accepted review issues in the Codex handoff', () => {
    const payload = buildHandoffPayload(scriptProject, version, reviews, drafts, decision)
    const acceptedIds = reviews.filter((item) => item.status === 'accepted').map((item) => item.id)

    expect(payload.schema_version).toBe(1)
    expect(payload.project_id).toBe(scriptProject.id)
    expect(payload.task_type).toBe('commercial_script_revision')
    expect(payload.context.issues.map((item) => item.id)).toEqual(acceptedIds)
    expect(payload.expected_outputs).toEqual(['revised_script', 'change_summary'])
  })

  it('builds a readable Markdown review with the decision goal', () => {
    const markdown = buildReviewMarkdown(scriptProject, version, reviews, decision)

    expect(markdown).toContain(`# ${scriptProject.title}`)
    expect(markdown).toContain('## Human Review')
    expect(markdown).toContain('## Decision')
    expect(markdown).toContain(decision.nextVersionGoal || '待确认')
  })
})
