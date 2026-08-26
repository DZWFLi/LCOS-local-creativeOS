/**
 * 教工作流 MVP（第一梯队核心能力 A）测试：编排 → 保存 → 一键重放。
 * 覆盖：serialize 步骤链 ↔ parse 往返、SKILL.md 识别逻辑、重放参数构造纯函数。
 * 第二梯队沉淀池 GUI：运行历史投影 / 搜索过滤 / 排序 / 历史文案纯函数。
 */
import { describe, expect, it } from 'vitest'

import {
  buildReplayInstruction,
  buildWorkflowSkillSpec,
  collectSkillMaterialViewIds,
  deriveSkillRunSteps,
  filterWorkflowSkills,
  formatSkillRunStats,
  isWorkflowSkillMarkdown,
  parseWorkflowSkillSteps,
  projectSkillRunStats,
  serializeWorkflowSkill,
  sortWorkflowSkills,
  type SkillStepInput,
  type WorkflowSkillSummary,
} from '../src/features/workflow/skillLibrary'
import { parseWorkflowFile } from '../src/features/workflow/workflowModel'

const sampleSteps: readonly SkillStepInput[] = [
  { label: '确认创意方向', materials: [{ viewId: 'view-a', title: '品牌手册' }, { viewId: 'view-b', title: '竞品分析' }] },
  { label: '产出方案初稿', materials: [{ viewId: 'view-a', title: '品牌手册' }] },
  { label: '内部评审', materials: [] },
]

describe('workflow-skill — serialize 步骤链 → parse 往返', () => {
  it('serialize 产出的 SKILL.md 可被 parseWorkflowFile 还原 frontmatter', () => {
    const raw = serializeWorkflowSkill({ name: '品牌方案三步走', steps: sampleSteps })
    const parsed = parseWorkflowFile(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.name).toBe('品牌方案三步走')
    expect(parsed!.description).toContain('共 3 步')
    expect(parsed!.description).toContain('确认创意方向')
    expect(parsed!.body).toContain('## 步骤 1：确认创意方向')
    expect(parsed!.body).toContain('[品牌手册](view:view-a)')
  })

  it('serialize → parse 往返保留步骤顺序、label、材料 viewId（live pointer，不复制内容）', () => {
    const raw = serializeWorkflowSkill({ name: '往返', steps: sampleSteps })
    const parsed = parseWorkflowSkillSteps(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.steps.map((step) => step.label)).toEqual(['确认创意方向', '产出方案初稿', '内部评审'])
    expect(parsed!.steps[0].materials.map((material) => material.viewId)).toEqual(['view-a', 'view-b'])
    expect(parsed!.steps[0].materials[0].title).toBe('品牌手册')
    expect(parsed!.steps[2].materials).toEqual([])
  })

  it('材料标题中的方括号被清空，viewId 保持原样（寻址只靠 viewId）', () => {
    const raw = serializeWorkflowSkill({
      name: '括号',
      steps: [{ label: '带括号材料', materials: [{ viewId: 'view-x', title: '《报告 [终稿]》' }] }],
    })
    const parsed = parseWorkflowSkillSteps(raw)
    expect(parsed!.steps[0].materials[0].viewId).toBe('view-x')
    expect(parsed!.steps[0].materials[0].title).toBe('《报告 终稿》')
  })

  it('自定义 description 覆盖自动摘要', () => {
    const spec = buildWorkflowSkillSpec({ name: '自定义', steps: sampleSteps, description: '白领教的三步流程' })
    expect(spec.description).toBe('白领教的三步流程')
  })
})

describe('workflow-skill — SKILL.md 识别逻辑', () => {
  it('serialize 产物是技能', () => {
    expect(isWorkflowSkillMarkdown(serializeWorkflowSkill({ name: '技能', steps: sampleSteps }))).toBe(true)
  })

  it('普通 markdown 笔记（无 frontmatter name / 无步骤段）不是技能', () => {
    expect(isWorkflowSkillMarkdown('# 随手笔记\n\n一些想法')).toBe(false)
    expect(isWorkflowSkillMarkdown('---\nname: "只有名字没有步骤"\n---\n\n没有步骤段的正文')).toBe(false)
    expect(isWorkflowSkillMarkdown('---\ndescription: "有描述但没名字"\n---\n\n## 步骤 1：做点什么')).toBe(false)
    expect(isWorkflowSkillMarkdown('')).toBe(false)
  })

  it('人工编辑 description 后 parse 同步显示（DoD ② 纯函数层）', () => {
    const raw = serializeWorkflowSkill({ name: '可编辑技能', steps: sampleSteps })
      .replace('共 3 步的教工作流', '我亲手改过的描述 共 3 步的教工作流')
    const parsed = parseWorkflowSkillSteps(raw)
    expect(parsed!.description).toContain('我亲手改过的描述')
  })

  it('人工新增步骤段后 parse 同步步数', () => {
    const raw = serializeWorkflowSkill({ name: '可扩展', steps: sampleSteps.slice(0, 2) })
      + '\n\n## 步骤 3：人工补的一步\n\n材料：\n- [新材料](view:view-new)\n'
    const parsed = parseWorkflowSkillSteps(raw)
    expect(parsed!.steps.length).toBe(3)
    expect(parsed!.steps[2].label).toBe('人工补的一步')
    expect(parsed!.steps[2].materials[0].viewId).toBe('view-new')
  })
})

describe('workflow-skill — 重放参数构造纯函数', () => {
  it('buildReplayInstruction 拼出有序步骤指令与材料提示', () => {
    const instruction = buildReplayInstruction({ name: '品牌方案三步走', steps: sampleSteps })
    expect(instruction).toContain('「品牌方案三步走」')
    expect(instruction.indexOf('1. 确认创意方向')).toBeLessThan(instruction.indexOf('2. 产出方案初稿'))
    expect(instruction).toContain('品牌手册、竞品分析')
    expect(instruction).toContain('严格按上述步骤顺序执行')
  })

  it('collectSkillMaterialViewIds 保序去重（跨步骤复用同一材料只取一次）', () => {
    expect(collectSkillMaterialViewIds(parseWorkflowSkillSteps(serializeWorkflowSkill({ name: 'x', steps: sampleSteps }))!.steps))
      .toEqual(['view-a', 'view-b'])
  })

  it('collectSkillMaterialViewIds 对空材料链返回空数组', () => {
    expect(collectSkillMaterialViewIds([{ label: '空步', materials: [] }])).toEqual([])
  })
})

describe('workflow-skill — Run↔步骤链投影（deriveSkillRunSteps，20260826 做实）', () => {
  const skillWithMaterials: WorkflowSkillSummary = {
    artifactId: 'art-1', viewId: 'view-skill', title: 'SKILL · 品牌方案三步走', name: '品牌方案三步走',
    description: '', stepCount: 2,
    steps: [
      { label: '确认创意方向', materials: [{ viewId: 'view-a', title: '品牌手册' }] },
      { label: '产出方案初稿', materials: [] },
    ],
    createdAt: 100,
  }

  it('技能重放的 Run：从 instruction 反解技能并投影步骤链（label/status/材料 detail/viewIds）', () => {
    const instruction = buildReplayInstruction({ name: '品牌方案三步走', steps: skillWithMaterials.steps })
    const steps = deriveSkillRunSteps({ command: instruction, status: 'running' }, [skillWithMaterials])
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({ label: '确认创意方向', status: 'running' })
    expect(steps[0]?.detail).toBe('材料：品牌手册')
    expect(steps[0]?.viewIds).toEqual(['view-a'])
    expect(steps[1]).toMatchObject({ label: '产出方案初稿', status: 'running' })
    expect(steps[1]?.detail).toBeUndefined()
  })

  it('Run 状态如实映射步骤状态：completed→done、failed→failed、queued→pending、cancelled→info', () => {
    const instruction = buildReplayInstruction({ name: '品牌方案三步走', steps: skillWithMaterials.steps })
    expect(deriveSkillRunSteps({ command: instruction, status: 'completed' }, [skillWithMaterials])[0]?.status).toBe('done')
    expect(deriveSkillRunSteps({ command: instruction, status: 'failed' }, [skillWithMaterials])[0]?.status).toBe('failed')
    expect(deriveSkillRunSteps({ command: instruction, status: 'queued' }, [skillWithMaterials])[0]?.status).toBe('pending')
    expect(deriveSkillRunSteps({ command: instruction, status: 'cancelled' }, [skillWithMaterials])[0]?.status).toBe('info')
  })

  it('普通指令 Run / 技能已删除 / 指令格式损坏：一律返回空数组（不伪造步骤）', () => {
    expect(deriveSkillRunSteps({ command: '把第二页的图表改成柱状图', status: 'running' }, [skillWithMaterials])).toEqual([])
    expect(deriveSkillRunSteps({ command: '按已确认的工作流技能「不存在」执行：\n1. x', status: 'running' }, [skillWithMaterials])).toEqual([])
    expect(deriveSkillRunSteps({ command: '按已确认的工作流技能「', status: 'running' }, [skillWithMaterials])).toEqual([])
  })
})

/* ---------------- 第二梯队：StepLibrary 沉淀池 GUI 纯函数 ---------------- */

const summary = (artifactId: string, name: string, description: string, createdAt: number, stepLabels: readonly string[]): WorkflowSkillSummary => ({
  artifactId,
  viewId: `view-${artifactId}`,
  title: `SKILL · ${name}`,
  name,
  description,
  stepCount: stepLabels.length,
  steps: stepLabels.map((label) => ({ label, materials: [] })),
  createdAt,
})

const librarySkills: readonly WorkflowSkillSummary[] = [
  summary('art-1', '品牌方案三步走', '共 3 步的教工作流，首步「确认创意方向」。', 100, ['确认创意方向', '产出方案初稿', '内部评审']),
  summary('art-2', '周报汇总', '每周五汇总各线周报。', 300, ['收集材料', '汇总成文']),
  summary('art-3', 'Alpha 审计', '审计 Alpha 项目的交付物。', 200, ['收集材料', '逐项核对']),
]

describe('workflow-skill 沉淀池 — 运行历史投影（Run 节点 → runs/lastRunAt）', () => {
  it('匹配重放指令的 Run 节点计入对应技能：runs 计数 + lastRunAt 取最近', () => {
    const stats = projectSkillRunStats(librarySkills, [
      { commandText: '按已确认的工作流技能「周报汇总」执行：\n1. 收集材料', createdAt: '2026-08-25T10:00:00Z' },
      { commandText: '按已确认的工作流技能「周报汇总」执行：\n1. 收集材料', createdAt: '2026-08-25T12:00:00Z' },
      { commandText: '按已确认的工作流技能「品牌方案三步走」执行：\n1. 确认创意方向', createdAt: '2026-08-24T09:00:00Z' },
    ])
    expect(stats.get('art-2')).toEqual({ runs: 2, lastRunAt: Date.parse('2026-08-25T12:00:00Z') })
    expect(stats.get('art-1')).toEqual({ runs: 1, lastRunAt: Date.parse('2026-08-24T09:00:00Z') })
    expect(stats.get('art-3')).toBeUndefined()
  })

  it('非重放指令（普通 Run）、名字不匹配、格式残缺的节点全部忽略', () => {
    const stats = projectSkillRunStats(librarySkills, [
      { commandText: '总结这份品牌手册的要点', createdAt: '2026-08-25T10:00:00Z' },
      { commandText: '按已确认的工作流技能「不存在的技能」执行：\n1. 做点什么', createdAt: '2026-08-25T10:00:00Z' },
      { commandText: '按已确认的工作流技能「」执行：', createdAt: '2026-08-25T10:00:00Z' },
      { createdAt: '2026-08-25T10:00:00Z' },
    ])
    expect(stats.size).toBe(0)
  })

  it('无 createdAt 的重放 Run 只计数、不推进 lastRunAt（缺数据不造数）', () => {
    const stats = projectSkillRunStats(librarySkills, [
      { commandText: '按已确认的工作流技能「周报汇总」执行：\n1. 收集材料', createdAt: '2026-08-25T10:00:00Z' },
      { commandText: '按已确认的工作流技能「周报汇总」执行：\n1. 收集材料' },
    ])
    expect(stats.get('art-2')).toEqual({ runs: 2, lastRunAt: Date.parse('2026-08-25T10:00:00Z') })
  })
})

describe('workflow-skill 沉淀池 — 搜索过滤与排序', () => {
  it('搜索命中 name / description / 步骤 label（大小写不敏感），空查询返回全量', () => {
    expect(filterWorkflowSkills(librarySkills, '周报').map((skill) => skill.artifactId)).toEqual(['art-2'])
    expect(filterWorkflowSkills(librarySkills, '品牌').map((skill) => skill.artifactId)).toEqual(['art-1'])
    expect(filterWorkflowSkills(librarySkills, '逐项核对').map((skill) => skill.artifactId)).toEqual(['art-3'])
    expect(filterWorkflowSkills(librarySkills, 'ALPHA').map((skill) => skill.artifactId)).toEqual(['art-3'])
    expect(filterWorkflowSkills(librarySkills, '').length).toBe(3)
    expect(filterWorkflowSkills(librarySkills, '不存在的内容').length).toBe(0)
  })

  it('排序：created=最近创建在前；name=按 localeCompare；runs=次数降序且同次数回退最近创建', () => {
    const stats = projectSkillRunStats(librarySkills, [
      { commandText: '按已确认的工作流技能「品牌方案三步走」执行：\n1. 确认创意方向', createdAt: '2026-08-25T10:00:00Z' },
    ])
    expect(sortWorkflowSkills(librarySkills, new Map(), 'created').map((skill) => skill.artifactId)).toEqual(['art-2', 'art-3', 'art-1'])
    const expectedNameOrder = [...librarySkills].map((skill) => skill.name).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
    expect(sortWorkflowSkills(librarySkills, new Map(), 'name').map((skill) => skill.name)).toEqual(expectedNameOrder)
    expect(sortWorkflowSkills(librarySkills, stats, 'runs').map((skill) => skill.artifactId)).toEqual(['art-1', 'art-2', 'art-3'])
  })
})

describe('workflow-skill 沉淀池 — 运行历史文案', () => {
  it('无统计 / 零次显示「未运行过」；有统计显示次数 + 相对时间', () => {
    expect(formatSkillRunStats(undefined, () => '', 0)).toBe('未运行过')
    expect(formatSkillRunStats({ runs: 0, lastRunAt: null }, () => '', 0)).toBe('未运行过')
    const relative = (at: number, now: number) => `${Math.round((now - at) / 60000)} 分钟前`
    expect(formatSkillRunStats({ runs: 3, lastRunAt: 1000 }, relative, 61000)).toBe('运行 3 次 · 1 分钟前')
  })
})
