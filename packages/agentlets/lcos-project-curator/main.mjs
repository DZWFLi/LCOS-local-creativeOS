/**
 * lcos-project-curator — P0-C semantic execution bridge agentlet harness。
 *
 * env 契约（宿主 spawn 注入，与 canvas-organizer 同构）：
 *   LCOS_CORE_URL / LCOS_AGENTLET_TOKEN / LCOS_SESSION_ID
 *   LCOS_PROJECT_ID / LCOS_SCOPE_ID / LCOS_AGENTLET_INSTRUCTION
 *
 * 闭环步骤：
 *   1. 读 LCOS_AGENTLET_INSTRUCTION（JSON 化的 CuratorReorganizeIntentV1）
 *   2. Reachback 读 current presentation
 *   3. 语义 provider 产出结构化 ReorganizeProposalV0（规则 provider 可换真实 LLM）
 *   4. Reachback POST /curator/ingest 回传 → 校验通过则由 ReorganizeService 持久化
 *
 * 边界：只提出方案；生产/预览/保留/回滚全走既有 ReorganizeService，本 harness 不改 canvas。
 */

const base = process.env.LCOS_CORE_URL
const token = process.env.LCOS_AGENTLET_TOKEN
const projectId = process.env.LCOS_PROJECT_ID
const scopeId = process.env.LCOS_SCOPE_ID
const sessionId = process.env.LCOS_SESSION_ID
const instructionRaw = process.env.LCOS_AGENTLET_INSTRUCTION

if (!base || !projectId || !scopeId || !sessionId) {
  console.error('missing required env: LCOS_CORE_URL / LCOS_PROJECT_ID / LCOS_SCOPE_ID / LCOS_SESSION_ID')
  process.exit(1)
}

const headers = {
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
}

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.ok === false) {
    throw new Error(`${method} ${path} -> ${response.status}: ${json?.error?.message ?? 'unknown'}`)
  }
  return json.value ?? json
}

function fail(code, message) {
  console.error(JSON.stringify({ ok: false, code, message }))
  process.exit(1)
}

let intent
try {
  intent = JSON.parse(instructionRaw ?? '{}')
} catch {
  fail('invalid_input', 'LCOS_AGENTLET_INSTRUCTION is not valid JSON')
}
if (!intent?.presentationId) {
  fail('invalid_input', 'intent.presentationId is required')
}
if (intent?.schemaVersion !== 1) {
  fail('invalid_input', 'intent.schemaVersion must be 1')
}

// ---- Reachback 读：current presentation ----
const presentationId = intent.presentationId
let presentationCall
try {
  presentationCall = await call('GET', `/projects/${encodeURIComponent(projectId)}/presentations/${encodeURIComponent(presentationId)}`)
} catch (error) {
  fail('runtime_failed', `presentation read failed: ${error.message}`)
  throw error
}
const presentation = presentationCall ?? {}
const state = presentation.state ?? {}
const memberViewIds = Array.isArray(state.memberViewIds) ? state.memberViewIds : []
const pinnedViewIds = Array.isArray(state.pinnedViewIds) ? state.pinnedViewIds : []
const version = presentation.version ?? 0

// ---- 语义 provider：优先经 Core 调真实 LLM（凭证在 Core），不可用时诚实降级规则 provider ----
const selectionViewIds = Array.isArray(intent.selectionViewIds) ? intent.selectionViewIds : []
const movable = memberViewIds.filter((id) => !pinnedViewIds.includes(id))

const SEMANTIC_SCHEMA = { type: "object", properties: { proposal: { type: "object" }, summary: { type: "string" } }, required: ["proposal", "summary"], additionalProperties: false }
const semanticSystem = "你是 LCOS 项目语义整理器。根据当前 presentation 成员与 selection，输出一个 ReorganizeProposalV0（结构化 JSON）：mergeCandidates/removeMemberViewIds/artifactDeleteCandidates/relationPatch/positionPatch。只提出方案，不直接改项目。"
const semanticInput = { presentationId, memberViewIds, pinnedViewIds, selectionViewIds, intent: intent.intent || "" }

let proposal = null
let summary = "已生成安全位置梳理提案（" + movable.length + " 个可移动视图）"
let positionPlan = {}
try {
  const semantic = await call('POST', /projects//curator/semantic, { schemaName: 'curator-reorganize', schema: SEMANTIC_SCHEMA, system: semanticSystem, input: semanticInput })
  if (semantic && semantic.ok && semantic.value && semantic.value.proposal) {
    proposal = semantic.value.proposal
    summary = typeof semantic.value.summary === "string" && semantic.value.summary.length > 0 ? semantic.value.summary : summary
  }
} catch (error) {
  // semantic unavailable：诚实降级到规则 provider
  console.warn("[curator] semantic unavailable: " + error.message)
}

if (proposal === null) {
  // 规则 fallback：安全 reorder
  positionPlan = {}
  movable.forEach((id, index) => { positionPlan[id] = { x: 80 + (index % 4) * 220, y: 80 + Math.floor(index / 4) * 180 } })
  proposal = {
    schemaVersion: 0,
    id: `reorg-curator-${Date.now()}`,
    projectId,
    presentationId,
    baseVersion: version,
    status: "pending",
    mergeCandidates: [],
    removeMemberViewIds: [],
    artifactDeleteCandidates: [],
    ...(Object.keys(positionPlan).length === 0 ? {} : { positionPlan }),
    layoutIntent: { engine: "manual", preservePinned: true },
    createdAt: new Date().toISOString(),
  }
}
const result = {
  schemaVersion: 1,
  kind: 'reorganize-proposal',
  agentletId: 'lcos-project-curator',
  proposal,
  summary,
  ...(Object.keys(positionPlan).length === 0 ? {} : { positionPlan }),
}

// ---- Reachback 写：ingest 回传（校验 + ReorganizeService 持久化在 Core 侧）----
try {
  const ingested = await call('POST', `/projects/${encodeURIComponent(projectId)}/curator/ingest`, {
    sessionId,
    ...result,
  })
  console.log(JSON.stringify({ ok: true, agentletId: 'lcos-project-curator', sessionId, proposalId: ingested?.proposalId }))
} catch (error) {
  fail('runtime_failed', `ingest failed: ${error.message}`)
}