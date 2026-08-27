import { readFile } from 'node:fs/promises'
import { evaluateCliGate, cliDecisionAllows, gateRefusalMessage } from '../lib/execution-gate.mjs'

/**
 * Phase E write commands.
 *   lcos node create-text --project <id> --scope <scopeId> [--title "…"] (--body "…" | --stdin)
 *   lcos node update-text --project <id> (--view <viewId> | --artifact <artifactId>) (--body "…" | --stdin)
 *   lcos curation apply --project <id> (--json file.json | --stdin)
 * stdout: pure JSON.
 */

const option = (rest, name) => {
  const index = rest.indexOf(`--${name}`)
  return index < 0 ? undefined : rest[index + 1]
}

const required = (value, label) => {
  if (value === undefined || value === '') throw new Error(`${label} is required`)
  return value
}

const bodyFrom = async (rest) => {
  const inline = option(rest, 'body')
  if (inline !== undefined) return inline
  const stdinFile = option(rest, 'stdin')
  if (stdinFile !== undefined) return readFile(stdinFile, 'utf8')
  throw new Error('text body required: pass --body "…" or --stdin <file>')
}

export async function runCurationWriteCommand({ group, action, rest, coreRequest }) {
  const projectId = required(option(rest, 'project'), '--project')
  if (group === 'node' && action === 'create-text') {
    const scopeId = required(option(rest, 'scope'), '--scope')
    const title = option(rest, 'title')
    const body = await bodyFrom(rest)
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/curation/text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scopeId, ...(title === undefined ? {} : { title }), body }),
      timeoutMs: 30_000,
    })
  }
  if (group === 'node' && action === 'update-text') {
    const viewId = option(rest, 'view')
    const artifactId = option(rest, 'artifact')
    const sessionId = option(rest, 'session')
    if (viewId === undefined && artifactId === undefined) throw new Error('--view or --artifact required')
    const body = await bodyFrom(rest)
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/curation/text`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...(viewId === undefined ? {} : { viewId }), ...(artifactId === undefined ? {} : { artifactId }), ...(sessionId === undefined ? {} : { sessionId }), body }),
      timeoutMs: 30_000,
    })
  }
  if (group === 'curation' && action === 'apply') {
    const jsonFile = option(rest, 'json')
    if (jsonFile === undefined) throw new Error('--json <file> required')
    const patch = JSON.parse(await readFile(jsonFile, 'utf8'))
    if (patch.projectId === undefined) patch.projectId = projectId
    // Phase 6 Execution Gate：含 deleteTexts → artifact.delete（destructive，须 --yes）；
    // 否则 curation.text.create/update（reversible，ChangeSet 记账静默放行）。
    const operation = Array.isArray(patch.deleteTexts) && patch.deleteTexts.length > 0 ? 'artifact.delete' : 'curation.text.create'
    const decision = await evaluateCliGate({ operation, targets: [projectId] })
    if (!cliDecisionAllows(decision, rest.includes('--yes'))) {
      throw new Error(gateRefusalMessage(decision, '（含删除操作；确认后加 --yes 重试）'))
    }
    return coreRequest(`/projects/${encodeURIComponent(projectId)}/curation/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      timeoutMs: 60_000,
    })
  }
  throw new Error(`Unknown write command: lcos ${group} ${action ?? ''}`)
}
