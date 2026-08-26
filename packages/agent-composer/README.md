# agent-composer 包定位（0.1）

`packages/agent-composer` 在 0.1 是**契约文档包**：交付 `SKILL.md`（Agent 编排工作台的四层施工契约），
本身不含可执行代码。TS 包实现（注册表读写 API、composer-types 的运行时校验、技能池 repo 层）留 0.2。

## 0.1 = 契约文档 + 前端既有实现映射

四层契约在 `frontend-focus/src/` 已有对应实现，本包文档即它们的施工规范：

| 契约层 | 契约文档落点 | 前端已有实现（frontend-focus/src/） |
| --- | --- | --- |
| protected registry（受保护组件注册表） | 本包 SKILL.md「数据模型 §1」 | `features/spatial/model/surfaceComponentCatalog.ts`（`SURFACE_COMPONENT_CATALOG` 15 类，createMode 三态） |
| composer-types（编排契约） | 本包 SKILL.md「数据模型 §2」 | `packages/contracts/src/index.ts`（`AgentPlanRequestV1` / `AgentExecutionPlanV1` / `CreateRunProposal` / `RunProposalResult` / `RuntimeProviderStatus`） |
| skill-pool（技能池存复用） | 本包 SKILL.md「数据模型 §3」 | `features/workflow/skillLibrary.ts`（serialize/parse/replay/检索纯函数）+ `features/workflow/workflowModel.ts`（SKILL.md frontmatter 双向） |
| agent 缺能力提议→accept→沉淀 | 本包 SKILL.md「数据模型 §4」 | `features/spatial/model/surfaceIntent.ts` + `surfaceOps.ts`（fail-closed）+ `features/spatial/components/SurfaceComponentProposalLayer.tsx` + `features/surfaces/AgentSurfaceComposer.tsx` |
| Workbench 四区壳 | 本包 SKILL.md「数据模型」末段 | `features/workbench/WorkbenchFrame.tsx` + `features/workflow/RunOutlinePanel.tsx` + `features/workflow/ToolResultCard.tsx` |

## 与其它 skills 的分工

- 组件怎么搭（Review/Step/结构岛/关系场/演进/Pack/活动路径）：`packages/skills/lcos-*` 各契约。
- 视觉红线：`packages/skills/lcos-glaze-materials`（四层施工标准 + D-1 对照 + token 契约）。
- 执行面：`packages/skills/lcos-executor-run`（认领/执行/提交，不在本包范围）。
- 浏览器桥：`packages/skills/lcos-browser-bridge`（MCP server 已在 `tools/lcos-browser-bridge/mcp_server.py` 实现）。

## 0.2 留题

- TS 包骨架：registry 查询 API + composer-types schema 校验 + skill-pool repo（读写 SKILL.md artifact）。
- `agent-workspace` 机制的 TS 等价物（参考 `browser-harness-reference/agent-workspace/agent_helpers.py` 的 agent 可编辑 helper + `domain-skills/<host>/` 站点技能沉淀形态）。
