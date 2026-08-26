/**
 * 教工作流 MVP（第一梯队核心能力 A）：技能库纯函数层。
 * 编排 → 保存 → 一键重放：
 * - 编排（教）：WorkflowSurface 上手动搭 Step 链（WorkflowActionV0）。
 * - 保存（存）：把 Step 链 serialize 成 SKILL.md（frontmatter + 步骤序列 markdown），
 *   存为 project 的一个受管 markdown artifact（材料只存 viewId live pointer，不复制内容）。
 * - 重放（放）：把 SKILL.md parse 回步骤序列，构造与手动发起完全相同的 Run 指令。
 * 依赖 workflowModel 的 frontmatter 双向能力；纯函数零副作用。
 */

import type { RunStatus } from '../../model'
import type { RunOutlineStep } from './RunOutlineProvider'
import { parseWorkflowFile, serializeWorkflowFile, type WorkflowSpec } from './workflowModel'

/** 技能步骤的语义：做什么（label）+ 用什么材料（viewId live pointer 引用）。 */
export interface SkillStep {
  readonly label: string
  readonly materials: readonly {
    readonly viewId: string
    readonly title: string
  }[]
}

/** 保存时的输入：步骤链（label + 材料的 viewId/标题，标题仅用于人读，不参与重放寻址）。 */
export type SkillStepInput = SkillStep

/** 技能列表项：由 App 层扫描项目的受管 markdown artifact 并 parse 得出。 */
export interface WorkflowSkillSummary {
  readonly artifactId: string
  readonly viewId: string
  readonly title: string
  readonly name: string
  readonly description: string
  readonly stepCount: number
  /** 步骤序列（详情预览渲染用；与 stepCount 同源）。 */
  readonly steps: readonly SkillStep[]
  /** 技能 artifact 的创建时间（epoch ms；排序用）。 */
  readonly createdAt: number
}

/** 重放指令的固定前缀（App 层发起 Run 与运行历史投影共用，保证两侧同源）。 */
export const SKILL_REPLAY_INSTRUCTION_PREFIX = '按已确认的工作流技能「'

/** 一次技能重放的运行历史投影（从画布 Run 节点推导，不落 SKILL.md —— One Project Truth）。 */
export interface SkillRunStats {
  readonly runs: number
  /** 最近一次重放的时间（epoch ms）。 */
  readonly lastRunAt: number | null
}

/** 画布上 Run 节点的最小投影形状（App 层由 kind==='process' 节点传入）。 */
export interface SkillRunNodeLike {
  readonly commandText?: string
  readonly createdAt?: string
}

/**
 * 运行历史投影（纯函数）：技能名 → { runs, lastRunAt }。
 * 数据源是画布 Run 节点的 commandText（重放指令以「按已确认的工作流技能「X」执行」开头）。
 * 不写回 SKILL.md：运行次数是 Run 集合的投影，不制造第二份真相（grok-bot 的 runs[] 同构）。
 */
export function projectSkillRunStats(skills: readonly WorkflowSkillSummary[], runNodes: readonly SkillRunNodeLike[]): ReadonlyMap<string, SkillRunStats> {
  const byName = new Map(skills.map((skill) => [skill.name, skill.artifactId]))
  const stats = new Map<string, SkillRunStats>()
  for (const node of runNodes) {
    const command = node.commandText ?? ''
    if (!command.startsWith(SKILL_REPLAY_INSTRUCTION_PREFIX)) continue
    const rest = command.slice(SKILL_REPLAY_INSTRUCTION_PREFIX.length)
    const nameEnd = rest.indexOf('」执行')
    if (nameEnd <= 0) continue
    const artifactId = byName.get(rest.slice(0, nameEnd))
    if (artifactId === undefined) continue
    const at = node.createdAt !== undefined ? Date.parse(node.createdAt) : Number.NaN
    const current = stats.get(artifactId) ?? { runs: 0, lastRunAt: null }
    const validAt = Number.isNaN(at) ? null : at
    stats.set(artifactId, {
      runs: current.runs + 1,
      lastRunAt: validAt === null ? current.lastRunAt : Math.max(current.lastRunAt ?? 0, validAt),
    })
  }
  return stats
}

const normalize = (value: string): string => value.trim().toLowerCase()

/** 沉淀池搜索（纯函数）：匹配 name / description / 任一步骤 label（大小写不敏感包含）。 */
export function filterWorkflowSkills(skills: readonly WorkflowSkillSummary[], query: string): readonly WorkflowSkillSummary[] {
  const needle = normalize(query)
  if (needle.length === 0) return skills
  return skills.filter((skill) =>
    normalize(skill.name).includes(needle)
    || normalize(skill.description).includes(needle)
    || skill.steps.some((step) => normalize(step.label).includes(needle)))
}

export type WorkflowSkillSortMode = 'created' | 'name' | 'runs'

/** 沉淀池排序（纯函数）：created=最近创建 / name=名称 / runs=运行次数（次数相同回退最近创建）。 */
export function sortWorkflowSkills(skills: readonly WorkflowSkillSummary[], stats: ReadonlyMap<string, SkillRunStats>, mode: WorkflowSkillSortMode): readonly WorkflowSkillSummary[] {
  const runsOf = (skill: WorkflowSkillSummary): number => stats.get(skill.artifactId)?.runs ?? 0
  return [...skills].sort((a, b) => {
    if (mode === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN')
    if (mode === 'runs') {
      const difference = runsOf(b) - runsOf(a)
      if (difference !== 0) return difference
    }
    return b.createdAt - a.createdAt
  })
}

/** 运行历史文案（纯函数）：「未运行过」/「运行 3 次 · 5 分钟前」。 */
export function formatSkillRunStats(stats: SkillRunStats | undefined, relative: (at: number, now: number) => string, now: number): string {
  if (stats === undefined || stats.runs === 0) return '未运行过'
  const when = stats.lastRunAt !== null ? relative(stats.lastRunAt, now) : '—'
  return `运行 ${stats.runs} 次 · ${when}`
}

const STEP_HEADING = /^##\s*步骤\s*(\d+)?\s*[：:]?\s*(.*)$/

/** 材料引用行：`- [标题](view:viewId)`；viewId 是 presentation view id，跨刷新稳定。 */
const MATERIAL_LINE = /^[-*]\s*\[([^\]]*)\]\(view:([^)]+)\)\s*$/

function escapeMaterialTitle(title: string): string {
  return title.replace(/[\[\]]/g, '').trim()
}

/** 由 Step 链构造 SKILL.md 的正文（步骤序列 markdown）。 */
export function buildWorkflowSkillBody(steps: readonly SkillStepInput[]): string {
  return steps.map((step, index) => {
    const heading = `## 步骤 ${index + 1}：${step.label.replace(/\r?\n/g, ' ').trim()}`
    if (step.materials.length === 0) return heading
    const materials = step.materials
      .map((material) => `- [${escapeMaterialTitle(material.title) || material.viewId}](view:${material.viewId})`)
      .join('\n')
    return `${heading}\n\n材料：\n${materials}`
  }).join('\n\n')
}

/** 自动摘要：N 步 · 首步做什么。 */
export function deriveSkillDescription(steps: readonly SkillStepInput[]): string {
  if (steps.length === 0) return '空技能'
  const first = steps[0].label.trim()
  return `共 ${steps.length} 步的教工作流${first ? `，首步「${first}」` : ''}。`
}

/** 由 Step 链构造完整 WorkflowSpec（交给 serializeWorkflowFile 落成 SKILL.md 文本）。 */
export function buildWorkflowSkillSpec(args: {
  readonly name: string
  readonly steps: readonly SkillStepInput[]
  readonly description?: string
}): WorkflowSpec {
  return {
    name: args.name.trim(),
    description: args.description?.trim() || deriveSkillDescription(args.steps),
    body: buildWorkflowSkillBody(args.steps),
    trigger: null,
    sourceRef: null,
  }
}

/** 一步序列化：Step 链 → SKILL.md 文本。 */
export function serializeWorkflowSkill(args: {
  readonly name: string
  readonly steps: readonly SkillStepInput[]
  readonly description?: string
}): string {
  return serializeWorkflowFile(buildWorkflowSkillSpec(args))
}

/** 把 SKILL.md 文本 parse 回步骤序列；不是技能格式（无步骤段或无名称）返回 null。 */
export function parseWorkflowSkillSteps(raw: string): { readonly name: string; readonly description: string; readonly steps: readonly SkillStep[] } | null {
  const parsed = parseWorkflowFile(raw)
  if (parsed === null || parsed.name.length === 0) return null
  const steps: SkillStep[] = []
  let current: { label: string; materials: SkillStep['materials'] } | null = null
  for (const line of parsed.body.split(/\r?\n/)) {
    const heading = STEP_HEADING.exec(line.trim())
    if (heading !== null) {
      if (current !== null) steps.push(current)
      const label = (heading[2] ?? '').trim()
      const index = heading[1] !== undefined ? Number(heading[1]) : steps.length + 1
      current = { label: label || `步骤 ${index}`, materials: [] }
      continue
    }
    if (current === null) continue
    const material = MATERIAL_LINE.exec(line.trim())
    if (material !== null) {
      current = {
        ...current,
        materials: [...current.materials, { title: material[1]?.trim() ?? '', viewId: material[2]?.trim() ?? '' }],
      }
    }
  }
  if (current !== null) steps.push(current)
  if (steps.length === 0) return null
  return { name: parsed.name, description: parsed.description, steps }
}

/** 识别一个 markdown 文本是否是可重放的技能（frontmatter name + 至少一个步骤段）。 */
export function isWorkflowSkillMarkdown(raw: string): boolean {
  return parseWorkflowSkillSteps(raw) !== null
}

/**
 * 重放指令构造（纯函数）：把步骤序列拼成一次 Run 的 instruction。
 * 材料寻址靠 contextArtifactIds（App 层由 viewId 解析），文本里仅保留步骤语义与材料提示，
 * 这样人工编辑步骤描述后重放语义同步，而材料引用始终以 viewId 为准。
 */
export function buildReplayInstruction(skill: { readonly name: string; readonly steps: readonly SkillStep[] }): string {
  const lines = skill.steps.map((step, index) => {
    const materials = step.materials.map((material) => material.title || material.viewId).join('、')
    return `${index + 1}. ${step.label}${materials ? `（材料：${materials}）` : ''}`
  })
  return [
    `按已确认的工作流技能「${skill.name}」执行：`,
    ...lines,
    '请严格按上述步骤顺序执行；材料已作为上下文一并提供。',
  ].join('\n')
}

/** 汇总步骤材料 viewId（保序去重），App 层据此解析 contextArtifactIds。 */
export function collectSkillMaterialViewIds(steps: readonly SkillStep[]): readonly string[] {
  const seen = new Set<string>()
  for (const step of steps) for (const material of step.materials) {
    if (material.viewId && !seen.has(material.viewId)) seen.add(material.viewId)
  }
  return [...seen]
}

/** Run 整体状态 → 步骤条目状态：与 buildRunOutline 的 instructionStatus 同规则。 */
function skillRunStepStatus(status: RunStatus): RunOutlineStep['status'] {
  if (status === 'failed') return 'failed'
  if (status === 'running') return 'running'
  if (status === 'completed') return 'done'
  if (status === 'queued' || status === 'waiting_input' || status === 'review') return 'pending'
  return 'info' // cancelled：已撤回按中性记录
}

/**
 * Run 大纲的步骤链投影（纯函数）：技能重放的 Run 从 instruction 反解出步骤链。
 * 关联契约：重放指令由 buildReplayInstruction 写入（SKILL_REPLAY_INSTRUCTION_PREFIX + 技能名），
 * 这里按同一前缀反解并在技能表里按名匹配——Run 与 Workflow 步骤链由此接通，
 * 大纲面板经 buildRunOutline(run, steps, events) 消费（RunOutlineStep 的设计入口）。
 * 每步状态如实取 Run 整体状态：provider 把整条 instruction 当一次 Run 执行，不伪造分步进度。
 */
export function deriveSkillRunSteps(
  run: { readonly command: string; readonly status: RunStatus },
  skills: readonly WorkflowSkillSummary[],
): readonly RunOutlineStep[] {
  const command = run.command ?? ''
  if (!command.startsWith(SKILL_REPLAY_INSTRUCTION_PREFIX)) return []
  const rest = command.slice(SKILL_REPLAY_INSTRUCTION_PREFIX.length)
  const nameEnd = rest.indexOf('」执行')
  if (nameEnd <= 0) return []
  const skill = skills.find((item) => item.name === rest.slice(0, nameEnd))
  if (skill === undefined) return []
  const status = skillRunStepStatus(run.status)
  return skill.steps.map((step, index) => {
    const viewIds = step.materials.map((material) => material.viewId).filter((viewId) => viewId.length > 0)
    const titles = step.materials.map((material) => material.title).filter((title) => title.length > 0)
    return {
      id: `${skill.viewId}:${index}`,
      label: step.label,
      status,
      ...(titles.length === 0 ? {} : { detail: `材料：${titles.join('、')}` }),
      ...(viewIds.length === 0 ? {} : { viewIds }),
    }
  })
}
