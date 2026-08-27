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
    // Phase 6 Execution Gate：curation apply 契约（CurationPatchV0）只含
    // createTexts + relations + presentation——**没有删除面**。删除走 reorganize
    // proposal 的 artifactDeleteCandidates（destructive，服务端 PREVIEW 强制）。
    // 因此这里恒为 reversible（ChangeSet 记账静默放行），不留任何"看似有删除"的死分支。
    const decision = await evaluateCliGate({ operation: 'curation.text.create', targets: [projectId] })
    if (!cliDecisionAllows(decision, rest.includes('--yes'))) {
      throw new Error(gateRefusalMessage(decision))
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
