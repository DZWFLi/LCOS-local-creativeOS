import { readFile } from 'node:fs/promises'
import { evaluateCliGate, cliDecisionAllows, gateRefusalMessage } from '../lib/execution-gate.mjs'

/**
 * Phase E presentation patch:
 *   lcos presentation patch <projectId> <presentationId> --json patch.json
 * patch shape: { addMembers:[{entityId|clientRef}], removeMembers:[], setRenderer,
 *   setHierarchy, addPresentationEdges, removePresentationEdges, setEmphasis, pin, unpin }
 * expectedVersion is read from the current view automatically unless --expected-version N.
 */

const option = (rest, name) => {
  const index = rest.indexOf(`--${name}`)
  return index < 0 ? undefined : rest[index + 1]
}

export async function runPresentationCommand({ action, rest, coreRequest }) {
  if (action !== 'patch') throw new Error(`Unknown presentation command: ${action ?? ''}`)
  const projectId = rest[0]
  const presentationId = rest[1]
  if (projectId === undefined || presentationId === undefined) throw new Error('presentation patch requires <projectId> <presentationId>')
  const jsonFile = option(rest, 'json')
  if (jsonFile === undefined) throw new Error('--json <file> required')
  const patch = JSON.parse(await readFile(jsonFile, 'utf8'))
  const current = await coreRequest(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`)
  const expectedVersion = option(rest, 'expected-version') === undefined
    ? current.version
    : Number(option(rest, 'expected-version'))
  const contract = {
    ...current,
    state: applyPatch(current.state, patch),
    renderer: patch.setRenderer ?? current.renderer,
    updatedBy: 'agent',
    updatedAt: new Date().toISOString(),
  }
  // Phase 6 Execution Gate：presentation.apply = structural → stderr 预览后放行
  //（expectedVersion CAS 仍守最后一道）；confirm/deny 阻断（须 --yes / 越界）。
  const decision = await evaluateCliGate({ operation: 'presentation.apply', targets: [presentationId] })
  if (!cliDecisionAllows(decision, rest.includes('--yes'))) {
    throw new Error(gateRefusalMessage(decision, '（结构性变更；确认后加 --yes 重试）'))
  }
  if (decision.kind === 'preview') {
    process.stderr.write(`[execution-gate] presentation patch 预览（${presentationId}）: 成员 ${current.state.memberViewIds?.length ?? 0}→${contract.state.memberViewIds.length}，边 ${current.state.presentationEdges?.length ?? 0}→${contract.state.presentationEdges.length}，锁定 ${current.state.pinnedViewIds?.length ?? 0}→${contract.state.pinnedViewIds.length}（v${expectedVersion}）
`)
  }
  return coreRequest(`/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contract, expectedVersion }),
    timeoutMs: 30_000,
  })
}

function applyPatch(state, patch) {
  const members = new Set(state.memberViewIds ?? [])
  for (const member of patch.addMembers ?? []) {
    const id = member.entityId ?? member.clientRef
    if (id) members.add(id)
  }
  for (const id of patch.removeMembers ?? []) members.delete(id)
  const memberList = [...members]
  const orderByParent = patch.setHierarchy?.orderByParent ?? state.hierarchy?.orderByParent ?? {}
  const parentByViewId = patch.setHierarchy?.parentByViewId ?? state.hierarchy?.parentByViewId ?? {}
  let edges = [...(state.presentationEdges ?? [])]
  for (const edge of patch.addPresentationEdges ?? []) {
    const from = edge.from?.entityId ?? edge.from?.clientRef
    const to = edge.to?.entityId ?? edge.to?.clientRef
    if (!from || !to) throw new Error('presentation edge requires from/to ids')
    edges = [...edges.filter((item) => item.id !== edge.id), { id: edge.id, fromViewId: from, toViewId: to, ...(edge.label === undefined ? {} : { label: edge.label }) }]
  }
  const removedEdges = new Set(patch.removePresentationEdges ?? [])
  edges = edges.filter((edge) => !removedEdges.has(edge.id))
  let pinned = [...(state.pinnedViewIds ?? [])]
  for (const id of patch.pin ?? []) if (!pinned.includes(id)) pinned.push(id)
  const unpinned = new Set(patch.unpin ?? [])
  pinned = pinned.filter((id) => !unpinned.has(id))
  return {
    memberViewIds: memberList,
    hiddenViewIds: state.hiddenViewIds ?? [],
    positions: state.positions ?? {},
    hierarchy: { parentByViewId, orderByParent },
    presentationEdges: edges,
    pinnedViewIds: pinned,
    emphasisByViewId: { ...(state.emphasisByViewId ?? {}), ...(patch.setEmphasis ?? {}) },
  }
}
