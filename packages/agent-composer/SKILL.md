---
name: agent-composer
description: "搭或改 Workbench / Agent 编排面（四层：受保护注册表、composer 契约、技能池、能力提议）时用本 skill 施工；0.1 只有契约与前端实现映射，不写 TS 包。"
---

# agent-composer：Agent 编排工作台施工契约

## 何时不用（反边界）

- 不做执行：Run 的认领与提交走 `lcos-executor-run`，本 skill 只管「编排/保存/重放」的 UI 与契约接线。
- 不做第二个真相：技能池是 SKILL.md artifact（One Project Truth），不建独立技能数据库；运行次数是 Run 节点投影，不写回 SKILL.md。
- 不做 cron/自动化调度（workflowModel.ts 头注已剥离 trigger 调度语义；frontmatter 里 `trigger` 只解析不执行）。
- 不在 0.1 写 TS 包代码：本包 0.1 只交付契约文档 + 既有前端实现映射（见 README.md）。

## 数据模型（真实契约/函数名）

**四层结构（0.1 冻结）：**

1. **受保护注册表（protected registry）**：`SURFACE_COMPONENT_CATALOG`（`frontend-focus/src/features/spatial/model/surfaceComponentCatalog.ts`）是唯一组件能力注册表。每个 `SurfaceComponentCapabilityContract` 声明 `surfaces / minSize / movable / resizable / acceptsDrop / capabilities{bind,lens,collapse,removeProjection}` 与 `createMode`：
   - `presentation`：诚实可用，可即时创建；
   - `adapter-only`：只能绑定既有 durable identity，禁止空造（review/checkpoint/portal/workflow-step）；
   - `planned`：目录保留但不准露出假空组件。
   读法：`surfaceComponentContract(type)` 取单条；`surfaceComponentsFor(surface, createableOnly)` 按面过滤。
2. **composer 契约（composer-types）**：`frontend-focus/packages/contracts/src/index.ts`：
   - `AgentPlanRequestV1`：UI 只交自然语言 prompt + contextItems + editTargets + requestedProvider；
   - `AgentExecutionPlanV1 extends CreateRunProposal`：`humanSummary / risks / requiresConfirmation`；
   - `RunProposalResult`：`confidence: 'high'|'low'`、`decisionSource: 'agent'|'fallback'`、`ambiguity`；
   - `RuntimeProviderStatus`：`provider: 'workbuddy'|'codex'|'auto'`，availability `ready/busy/offline/manual`。
3. **技能池（skill-pool）**：`frontend-focus/src/features/workflow/skillLibrary.ts` 纯函数层。存：`serializeWorkflowSkill({name, steps})` → SKILL.md 文本（经 `serializeWorkflowFile`，frontmatter + `## 步骤 N：label` + `- [标题](view:viewId)` 材料行）；材料只存 viewId live pointer。取：`parseWorkflowSkillSteps(raw)`。放：`buildReplayInstruction(skill)` + `collectSkillMaterialViewIds(steps)`。检索：`filterWorkflowSkills` / `sortWorkflowSkills`（created/name/runs）。运行统计：`projectSkillRunStats(skills, runNodes)` 从画布 Run 节点 commandText 前缀 `SKILL_REPLAY_INSTRUCTION_PREFIX = '按已确认的工作流技能「'` 推导。
4. **能力提议→accept→沉淀**：`frontend-focus/src/features/spatial/model/surfaceIntent.ts` 的 `SurfaceIntent`（17 种 kind）经 `resolveSurfaceIntent(intent, context)` 产出 `SurfaceOp[]`；`surfaceOps.ts` 的 `validateSurfaceOps` fail-closed 批校验（一条非法全批拒绝），`applySurfaceOps` 落地。UI 通道：`AgentSurfaceComposer.tsx` 预览（`SurfaceComponentProposalLayer` 渲染虚影）→「保留」（applySurfaceOps）或「撤掉」。沉淀终点是技能池（onSaveSkill → SKILL.md artifact）。

**Workbench 四区壳**：`frontend-focus/src/features/workbench/WorkbenchFrame.tsx`。`workbenchRunPhase(runStatus)` 纯函数：`queued/running/waiting_input/review → 'active'`（横幅态），终态与无 Run → `'idle'`。四区全 slot props：`outlineSidebar`（挂 `RunOutlinePanel`）/ `children` / `toolResultPanel`（挂 `ToolResultCard`）/ `bannerAction` / `headerAction`。

## 施工标准（分步骤）

1. **搭 Workbench**：复用 `WorkbenchFrame`，禁止自造布局壳。Run 状态徽标用 `runStatusLabel`（`frontend-focus/src/model.ts`）；左区大纲接 `RunOutlinePanel`（data-testid="run-outline"），右区工具结果接 `ToolResultCard`（`.lcos-tool-result-card`，`<details>` 静态文档流，无 z-index）。
2. **读注册表再加组件**：任何「搭组件」任务先 `surfaceComponentContract(type)` 核对 `surfaces` 是否包含当前面、`createMode` 是否允许自建；`adapter-only` 类型必须先有真实 identity（runId/checkpointId）再建，构造 id 形如 `surface:review:${runId}`（见 WorkflowSurface.tsx 的 `addBoundComponent`）。
3. **Agent 提议链**：新意图只能加 `SurfaceIntent` kind + `componentForIntent` 映射，产出 create-component op；不得旁路 `resolveSurfaceIntent` 直接写 surfaceElements。预览态走 proposalOps，保留时才 `applySurfaceOps`。
4. **技能存/放接线**：存 → `onSaveSkill({name, steps})`（App 层落 SKILL.md artifact）；放 → `onReplaySkill(skill)` 走与手动链相同的 Run 发起路径（App.tsx 里 `savedContextId` 一并传入）。
5. **agent-workspace 机制借鉴**（browser-harness-reference）：`agent-workspace/agent_helpers.py` 是 agent 可编辑的 helper 落点（`BH_AGENT_WORKSPACE` 指向）；站点技能沉淀为 `domain-skills/<host>/*.md`。LCOS 对应物：技能池 SKILL.md + `packages/skills/` 下各契约 skill。

## 视觉词汇（复用，禁自带样式）

- 壳：`.lcos-workbench-frame / -banner / -header / -zone`（spatial-components.css）。
- 提议浮层：`.lcos-agent-surface-composer-shell / .lcos-agent-surface-composer`；Glyth 状态用 `LcosGlyth`（`working`=预览中，`absorb`=展开，`stable`=常态）。
- 灯条：`LightSegment`（`mode: 'static'|'progress'|'checkpoint'|'flow'`）。
- 技能池：`.lcos-workflow-skill-panel / .lcos-skill-list / .lcos-skill-detail / .lcos-skill-toolbar`。
- token 全部走 `--lcos-*`（foundation.css / spatial-components.css 头部 token 区），z-index 只准 `var(--lcos-z-*)`。

## 验收（数值断言）

- `workbenchRunPhase('review') === 'active'`；`workbenchRunPhase('completed') === 'idle'`；`workbenchRunPhase(null) === 'idle'`。
- `validateSurfaceOps` 对含一条非法 op 的批次返回 `{ok:false, opIndex}` 且 `applySurfaceOps` 后元素数不变（fail-closed）。
- `parseWorkflowSkillSteps(serializeWorkflowSkill({name:'X', steps:[{label:'a', materials:[{viewId:'v1', title:'t'}]}]}))` round-trip 后 `steps[0].materials[0].viewId === 'v1'`。
- `filterWorkflowSkills` 空查询返回原数组长度；`sortWorkflowSkills(mode='runs')` 首项 runs ≥ 次项。
- `SURFACE_COMPONENT_CATALOG` 共 15 个类型；`surfaceComponentsFor('workflow')` 只返回 surfaces 含 'workflow' 的条目。
- stylelint（`.stylelintrc.cjs`）0 error：任何新 css 的 z-index 出现裸数字即失败。

## 已知边界（0.1 不做什么，不假装）

- 不写 agent-composer 的 TS 包实现（0.2 交付）；本包 0.1 = SKILL.md 契约 + README 映射。
- 不做 trigger/cron 调度、@引用富文本（workflowModel.ts 已显式剥离）。
- `WebWorkbench` 里「两页比较/文案版本对比」保持 disabled（等 Core artifact revision API），不得假装可用。
- 提议链不做自然语言意图理解：`AgentSurfaceComposer` 只有下拉选 intent，`AgentPlanRequestV1` 的语义计划归 Agent/Skill 侧。
