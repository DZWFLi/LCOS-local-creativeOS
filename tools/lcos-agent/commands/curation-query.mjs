/**
 * Phase D: Agent-facing read commands.
 *   lcos node read <viewId> [--max-items N --max-chars-per-item N --max-total-chars N]
 *   lcos selection read [--max-items N ...]   (reads ActiveContext.selectedViewIds)
 *   lcos presentation show <presentationId>
 * stdout: pure JSON; diagnostics go to stderr.
 */

const option = (rest, name) => {
  const index = rest.indexOf(`--${name}`)
  return index < 0 ? undefined : rest[index + 1]
}

const required = (value, label) => {
  if (value === undefined || value === '') throw new Error(`${label} is required`)
  return value
}

const budgetFrom = (rest) => {
  const budget = {}
  const maxItems = option(rest, 'max-items')
  const maxChars = option(rest, 'max-chars-per-item')
  const maxTotal = option(rest, 'max-total-chars')
  if (maxItems !== undefined) budget.maxItems = Number(maxItems)
  if (maxChars !== undefined) budget.maxCharsPerItem = Number(maxChars)
  if (maxTotal !== undefined) budget.maxTotalChars = Number(maxTotal)
  return budget
}

export async function runCurationCommand({ group, action, rest, coreRequest }) {
  if (group === 'presentation' && action === 'show') {
    const projectId = required(rest[0], 'project id')
    const presentationId = required(rest[1], 'presentation id')
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`)
  }
  if (group === 'node' && action === 'read') {
    const projectId = required(rest[0], 'project id')
    const viewId = required(rest[1], 'view id')
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/curation/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewIds: [viewId], budget: budgetFrom(rest) }),
      timeoutMs: 30_000,
    })
  }
  if (group === 'selection' && action === 'read') {
    const projectId = required(rest[0], 'project id')
    const active = await coreRequest(`/projects/${encodeURIComponent(projectId)}/active-context`)
    const selectedViewIds = Array.isArray(active?.selectedViewIds) ? active.selectedViewIds : []
    if (selectedViewIds.length === 0) {
      return { schemaVersion: 0, items: [], truncated: false, budget: budgetFrom(rest), note: 'ActiveContext has no selected views' }
    }
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/curation/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewIds: selectedViewIds, budget: budgetFrom(rest) }),
      timeoutMs: 30_000,
    })
  }
  throw new Error(`Unknown curation command: lcos ${group} ${action ?? ''}`)
}
