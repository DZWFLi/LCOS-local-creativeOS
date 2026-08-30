/**
 * lcos-skill-author — P0-D semantic execution bridge agentlet harness。
 *
 * env 契约（宿主 spawn 注入，与 canvas-organizer 同构）：
 *   LCOS_CORE_URL / LCOS_AGENTLET_TOKEN / LCOS_SESSION_ID
 *   LCOS_PROJECT_ID / LCOS_SCOPE_ID / LCOS_AGENTLET_INSTRUCTION
 *
 * 闭环步骤：
 *   1. 读 LCOS_AGENTLET_INSTRUCTION（JSON 化的 SkillAuthorExecuteIntentV1）
 *   2. Reachback 读 GET /runs/:id/recipe（frozen RunRecipe）
 *   3. 语义 provider 产出结构化 SkillAuthorResultV1（规则 provider 可换真实 LLM）
 *   4. Reachback POST /skill-author/ingest 回传 → 校验通过则由 SkillProposalService 持久化
 *
 * 边界：只提出 proposal；review / accept / install 全走既有 SkillProposalService + SkillPackageService（CAS）。
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
if (!intent?.runId) {
  fail('invalid_input', 'intent.runId is required')
}
if (intent?.schemaVersion !== 1) {
  fail('invalid_input', 'intent.schemaVersion must be 1')
}

// ---- Reachback 读：frozen RunRecipe ----
let recipe
try {
  recipe = await call('GET', `/runs/${encodeURIComponent(intent.runId)}/recipe`)
} catch (error) {
  fail('runtime_failed', `run recipe read failed: ${error.message}`)
  throw error
}
const prompt = recipe?.prompt ?? ''
const outputIntent = recipe?.intent ?? 'revise'
const provider = recipe?.provider ?? 'workbuddy'
const runCompletedAt = recipe?.createdAt ?? new Date().toISOString()

// ---- 语义 provider：优先经 Core 调真实 LLM（凭证在 Core），不可用时诚实降级规则 provider ----
const baseId = prompt.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "run-skill"
const description = ("从 Run " + intent.runId + " 提炼的可复用方法（" + outputIntent + "）。").slice(0, 200)

const SEMANTIC_SCHEMA = { type: "object", properties: { content: { type: "string" }, summary: { type: "string" }, methods: { type: "array", items: { type: "string" } }, facts: { type: "array", items: { type: "string" } } }, required: ["content", "summary", "methods", "facts"], additionalProperties: false }
const semanticSystem = "你是 LCOS Skill 炼制器。根据来源 Run 的 prompt 与输出意图，产出可复用 SKILL.md（frontmatter name/description/version + 正文方法结构）与 Method-vs-Fact 判定（methods 是可跨项目复用的方法，facts 是一次性事实）。只提出候选草稿，不直接安装。"
const semanticInput = { runId: intent.runId, prompt, outputIntent, provider }

let content = null
let summary = "已生成可复用 Skill 底稿「" + baseId + "」"
let methods = []
let facts = []
try {
  const semantic = await call('POST', /projects//skill-author/semantic, { schemaName: 'skill-author-proposal', schema: SEMANTIC_SCHEMA, system: semanticSystem, input: semanticInput })
  if (semantic && semantic.ok && semantic.value && semantic.value.content) {
    content = semantic.value.content
    summary = typeof semantic.value.summary === "string" && semantic.value.summary.length > 0 ? semantic.value.summary : summary
    methods = Array.isArray(semantic.value.methods) ? semantic.value.methods : []
    facts = Array.isArray(semantic.value.facts) ? semantic.value.facts : []
  }
} catch (error) {
  console.warn("[skill-author] semantic unavailable: " + error.message)
}

if (content === null) {
  content = [
    "---",
    "name: " + baseId,
    "description: " + description,
    "version: 0.1.0",
    "---",
    "",
    "# " + baseId,
    "",
    "## 何时用 / 何时不用",
    "",
    "用：与来源 Run 相同类型的任务。不用：一次性事实整理。",
    "",
    "## 方法（规则提炼底稿，待 Skill Author 语义提炼后复核）",
    "",
    "1. 按来源 prompt 的方法组织同类任务。",
    "2. 产出意图：" + outputIntent + "。",
    "",
    "## 来源",
    "",
    "- Run：" + intent.runId + "（provider " + provider + "，completed at " + runCompletedAt + "）",
  ].join("\\n")
  methods = ["按来源 prompt 组织同类任务"]
  facts = []
}
const result = {
  schemaVersion: 1,
  kind: 'skill-proposal',
  agentletId: 'lcos-skill-author',
  draft: { skillId: baseId, name: baseId, description, content },
  methodFact: { methods, facts },
  source: {
    runId: intent.runId,
    prompt,
    intent: outputIntent,
    orderedReferenceCount: 0,
    provider,
    runCompletedAt,
  },
  summary,
}

// ---- Reachback 写：ingest 回传（校验 + SkillProposalService 持久化在 Core 侧）----
try {
  const ingested = await call('POST', `/projects/${encodeURIComponent(projectId)}/skill-author/ingest`, {
    sessionId,
    ...result,
  })
  console.log(JSON.stringify({ ok: true, agentletId: 'lcos-skill-author', sessionId, proposalId: ingested?.proposalId }))
} catch (error) {
  fail('runtime_failed', `ingest failed: ${error.message}`)
}