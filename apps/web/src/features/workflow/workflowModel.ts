/**
 * SKILL.md 工作流模型（0.5 波）。
 * 核心语义照抄 grok-bot 的 shared/workflow-model.ts（MIT），剥离其外部依赖：
 * - 不抄 workflows.js / automations.js / automation-schedule.js 相关
 *   （workflowToAutomation / automationToWorkflow / cronTrigger / describeSchedule —— cron 调度 0.1 不做）
 * - 不抄富文本相关（collectWorkflowReferences / collectMentionedWorkflows —— @引用留二梯队）
 * - 不抄 renderWorkflowsSystemPrompt（Agent 系统提示词拼装不在本层）
 * 保留：frontmatter 解析（缩进栈式 YAML）+ 序列化 + live pointer + 名称派生。
 * 纯函数零依赖。
 */

export const WORKFLOW_FILENAME = 'SKILL.md'
export const WORKFLOW_MAX_NAME_LENGTH = 80
export const WORKFLOW_MAX_DESCRIPTION_LENGTH = 1_536
export const WORKFLOW_MAX_BODY_LENGTH = 100_000

export interface WorkflowTrigger {
  schedule: string
  isEnabled: boolean
}

export interface WorkflowSpec {
  name: string
  description: string
  body: string
  trigger: WorkflowTrigger | null
  sourceRef?: string | null
}

export interface ParsedWorkflow extends WorkflowSpec {
  sourceRef: string | null
  data: Record<string, unknown>
}

/* ---------------- 内部工具：clamp / scalar / frontmatter ---------------- */

function clampLine(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : ''
}

function clampBlock(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function clampWorkflowName(value: unknown): string {
  return clampLine(value, WORKFLOW_MAX_NAME_LENGTH)
}

function clampWorkflowDescription(value: unknown): string {
  return clampLine(value, WORKFLOW_MAX_DESCRIPTION_LENGTH)
}

function clampWorkflowBody(value: unknown): string {
  return clampBlock(value, WORKFLOW_MAX_BODY_LENGTH)
}

/** YAML 标量解析：true/false/null/~/数字/带引号字符串，其余按原字符串。 */
function scalar(raw: string): unknown {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '~') return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1).replace(/''/g, "'")
    } catch { /* 引号串解析失败则按原字符串 */ }
  }
  return value
}

/** 缩进栈式 YAML 解析：只支持嵌套对象与标量（够用且零依赖），跳过空行与 # 注释。 */
function parseFrontmatter(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }]
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim().length === 0 || raw.trimStart().startsWith('#')) continue
    const match = /^(\s*)([^:#][^:]*):(?:\s*(.*))?$/.exec(raw)
    if (match == null) continue
    const indent = match[1]?.length ?? 0
    const key = match[2]?.trim()
    if (!key) continue
    while ((stack.at(-1)?.indent ?? -1) >= indent) stack.pop()
    const parent = stack.at(-1)?.value ?? root
    const tail = match[3] ?? ''
    if (tail.trim().length === 0) {
      const nested: Record<string, unknown> = {}
      parent[key] = nested
      stack.push({ indent, value: nested })
    } else {
      parent[key] = scalar(tail)
    }
  }
  return root
}

/** 拆出 frontmatter（--- 包裹）与正文；没有合法 frontmatter 时整体按正文处理。 */
function splitMatter(raw: string): { data: Record<string, unknown>; content: string } {
  if (!raw.startsWith('---')) return { data: {}, content: raw }
  const lineEnd = raw.indexOf('\n')
  if (lineEnd < 0) return { data: {}, content: raw }
  const close = raw.indexOf('\n---', lineEnd)
  if (close < 0) return { data: {}, content: raw }
  return {
    data: parseFrontmatter(raw.slice(lineEnd + 1, close)),
    content: raw.slice(close + 4).replace(/^\r?\n/, ''),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function sourceRefOf(data: Record<string, unknown>): string | null {
  const metadata = isRecord(data.metadata) ? data.metadata : {}
  const raw = typeof metadata.source === 'string' ? metadata.source : data.source
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

function normalizeSchedule(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function triggerOf(data: Record<string, unknown>): WorkflowTrigger | null {
  if (!isRecord(data.trigger)) return null
  const schedule = normalizeSchedule(typeof data.trigger.schedule === 'string' ? data.trigger.schedule : '')
  return schedule.length === 0 ? null : { schedule, isEnabled: data.trigger.enabled !== false }
}

/* ---------------- 解析 / 序列化 ---------------- */

/** 解析一个 SKILL.md 文本；既无正文也无 frontmatter 时返回 null。 */
export function parseWorkflowFile(raw: string): ParsedWorkflow | null {
  let data: Record<string, unknown>
  let content: string
  try {
    ;({ data, content } = splitMatter(raw))
  } catch {
    data = {}
    content = raw
  }
  const body = clampWorkflowBody(content)
  if (body.length === 0 && Object.keys(data).length === 0) return null
  return {
    name: clampWorkflowName(data.name),
    description: clampWorkflowDescription(data.description),
    trigger: triggerOf(data),
    body,
    sourceRef: sourceRefOf(data),
    data,
  }
}

function yamlValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return 'null'
  return JSON.stringify(value)
}

function emitYaml(data: Record<string, unknown>, indent = 0): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (isRecord(value)) {
      lines.push(`${' '.repeat(indent)}${key}:`)
      lines.push(...emitYaml(value, indent + 2))
    } else {
      lines.push(`${' '.repeat(indent)}${key}: ${yamlValue(value)}`)
    }
  }
  return lines
}

/**
 * 序列化回 SKILL.md 文本。
 * metadata.source 处理照抄 grok-bot：spec.sourceRef 未指定时沿用 existingData 里的
 * metadata.source（或旧版顶层 source），指定非空则覆盖，空值则移除。
 */
export function serializeWorkflowFile(spec: WorkflowSpec, existingData: Record<string, unknown> = {}): string {
  const data: Record<string, unknown> = { ...existingData, name: spec.name }
  if (spec.description.length > 0) data.description = spec.description
  else delete data.description
  const legacySource = data.source
  delete data.source
  const metadata = isRecord(data.metadata) ? { ...data.metadata } : {}
  const nextSource = spec.sourceRef === undefined ? metadata.source ?? legacySource : spec.sourceRef
  if (typeof nextSource === 'string' && nextSource.length > 0) metadata.source = nextSource
  else delete metadata.source
  if (Object.keys(metadata).length > 0) data.metadata = metadata
  else delete data.metadata
  if (spec.trigger != null) data.trigger = { schedule: spec.trigger.schedule, enabled: spec.trigger.isEnabled }
  else delete data.trigger
  return `---\n${emitYaml(data).join('\n')}\n---\n${spec.body.trim()}\n`
}

/* ---------------- live pointer / 名称派生 ---------------- */

/** live pointer 的正文：说明 body 以源文件为准，必须现读现执行。 */
function buildLiveSourcePointerBody(source: string): string {
  return [
    `此工作流是指向 \`${source}\` 的活引用。`,
    '请立即用文件或抓取工具读取该源文件，并按其原文执行。不要凭这份说明猜测内容；源文件才是唯一事实，且可能在此工作流创建后已经更新。',
  ].join('\n')
}

/** 由源文件路径构造 live pointer 规格：body 只是一句"读源文件为准"的说明。 */
export function liveWorkflowSpecFromSource(args: { name: string; source: string; description?: string }): WorkflowSpec {
  const source = args.source.trim()
  const name = clampWorkflowName(args.name)
  const explicit = clampWorkflowDescription(args.description ?? '')
  return {
    name,
    description: explicit || clampWorkflowDescription(`当「${name}」技能适用时使用；它是对 ${source} 的活引用。`),
    body: clampWorkflowBody(buildLiveSourcePointerBody(source)),
    trigger: null,
    sourceRef: source,
  }
}

/** 从 Markdown 正文派生工作流名：首个非空行（剥掉标题符号与强调记号）。 */
export function deriveWorkflowNameFromMarkdown(body: string): string | null {
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const text = (/^#+\s+(.*)$/.exec(line)?.[1] ?? line).replace(/[*_`#>]/g, '').trim()
    if (text) return text.slice(0, WORKFLOW_MAX_NAME_LENGTH)
  }
  return null
}

/** 名称 → 目录 slug：小写、去变音、非字母数字折叠为连字符，兜底 "workflow"。 */
export function slugifyWorkflowName(name: string): string {
  const slug = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '')
  return slug || 'workflow'
}
