/**
 * Phase D: federated search command.
 *   lcos search "<query>" [--project <project-id>] [--limit N] [--types artifact,note,conversation,resource]
 *   project is optional when exactly one project is registered.
 * stdout: pure JSON.
 */

const option = (rest, name) => {
  const index = rest.indexOf(`--${name}`)
  return index < 0 ? undefined : rest[index + 1]
}

export async function runSearchCommand({ action, rest, coreRequest }) {
  const query = action
  if (query === undefined || query.trim() === '') throw new Error('lcos search requires a query string')
  const explicitProject = option(rest, 'project')
  let projectId = explicitProject
  if (projectId === undefined) {
    const projects = await coreRequest('/projects')
    if (!Array.isArray(projects) || projects.length === 0) throw new Error('No projects registered; pass a project id.')
    if (projects.length > 1) throw new Error('Multiple projects registered; pass a project id.')
    const recent = [...projects].sort((left, right) => String(right.lastOpenedAt ?? '').localeCompare(String(left.lastOpenedAt ?? '')))
    projectId = recent[0].id
  }
  const params = new URLSearchParams({ q: query })
  const limit = option(rest, 'limit')
  const types = option(rest, 'types')
  if (limit !== undefined) params.set('limit', limit)
  if (types !== undefined) params.set('types', types)
  return coreRequest(`/projects/${encodeURIComponent(projectId)}/search?${params.toString()}`, { timeoutMs: 120_000 })
}
