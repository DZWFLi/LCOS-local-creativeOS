# 接口产品化 S4–S10 只读审计 · 2026-08-17

## 审计说明

- 依据：`LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`（S0–S3 已 PASS，见 `docs/handoff/SESSION_0..3_*`）。
- 方式：只读符号扫描 + 组件抽查，**只记录问题，不实施修复**。未跑测试（按 Dz 指令）。
- 结论先行：S4–S10 均未按计划实施；S4 只有 UI 壳，S7 有 B5 遗留 service，S10 只有旧 golden-path，其余无代码痕迹。

---

## S1–S3 遗留债（前序已 PASS，但留债带账，给 GPT 一并处理）

### S1｜Codex Continuity 真 Harness 主链

1. `analyze` + `reply_only` 无 ArtifactReturn 属既有合同（无产物可 Accept）；intake 因此同时挂在 `completed` 转场与 `accept` 两处。create/revise 的 Return→Accept→intake 由 runtime-application-service / accept 路由覆盖，但未做第二次真实 revise Run 验证。
2. `run.sessionId` 暂用 `run.queued` 事件 payload 承载（避免 run 表 schema 变更）；S9 需决定是否落正式字段。
3. `lcos-executor` MCP 在用户 config 默认 `enabled=false`，依赖 runner 每次 `-c enabled=true` 覆盖；长期可考虑单独 executor profile。
4. 未做 Web 浏览器点击式 E2E（S1 当时只做了真实 Codex Run 链验证）。

### S2｜Handoff / Session Summary → Context History

1. **「从选择沉淀上下文」右键流程真机未产出 Context**：菜单动作执行后 context-graph 无 dot，疑似 presentation mutation 与 scope 持久化时序问题；与 S5/S6 的 Context 创建/成员语义直接相关，需根因化。
2. Deposit Hint 的「真实可见性」依赖 cooldown + evidence 门，未做真机时序验证（候选来源已由源契约测试锁定）。
3. 未做 Handoff 管理后台 / 删除 UI（计划明确不做，GPT 不要顺手加）。

### S3｜Context Snapshot Branch 收成 Core 单一路径

1. CLI 无 snapshot branch 命令（GUI/Agent 共享 Core 端点；CLI 缺口归 S9 统一决定）。
2. 分支按钮原语义「建现场」已被 Core「collection 分支」语义替代；若要保留「从历史恢复成 Workspace」旧语义，需另定 Core Workspace-restore 端点（当前未实现，勿擅自扩展）。

---

## S4｜SurfaceAgentNode 真局部 Agent

- 计划：Agent Node = 真局部上下文 + Session + Reply Summary；只能存在于 Context / Workflow。
- 现状：`SurfaceAgentNode.tsx` 是纯提示词输入浮层（prompt + contextLabel + 提交回调），无 Session 绑定、无 Reply Summary、无上下文包结构。
- 问题记录：
  1. 无 Session 绑定与 resume/attach 接入（S1 主链只覆盖主画布 Run）。
  2. 提交回调 `onSubmit(prompt)` 无结构化上下文载荷，Agent 实际收到什么未定义。
  3. 无 Reply Summary 呈现；`sent` 状态只是 UI 占位。
  4. 主画布不恢复 Agent Node 的冻结规则仍需由 GPT 在实现时校验。

## S5｜Context Agent Node → Proposal Producer

- 计划：Context 里的 Agent 产出 Proposal（Keep/Modify/Reject 可审查）。
- 现状：全仓无 `ProposalProducer` / proposal-producer 符号；`ReorganizePanel`（Pass2 引入）的「整理这些」仍是客户端/面板路径，未接 Proposal 语义。
- 问题记录：整条 Proposal 产出链缺失，需先定 Proposal 数据形态与 Review UI 契约。

## S6｜ImportBatchRef

- 计划：Agent 能理解「刚导入这一批」，把整批作为一次 Reorganize 输入。
- 现状：web/core 无 `ImportBatch` / `batchRef` / `importBatch` 符号。
- 问题记录：无批量导入引用标识；文件导入路径（source-first 导入）没有批次概念可被 Agent 消费。

## S7｜Feedback / ChangeSet → Revision 结果升级

- 计划：Feedback / ChangeSet 只作为「结果升级」路径，不作为独立编辑入口。
- 现状：`apps/local-core/src/feedback-revision-service.ts` 存在（B5 遗留）；web 无对应消费入口证据。
- 问题记录：需要 GPT 对照计划验收：Feedback 是否只作用于 Agent 产生的结果、是否与普通人工编辑路径解耦；本次审计未验证行为。

## S8｜Context / Workflow Boundary AI Evaluator

- 计划：把边界启发式升级为低频真实判断（Context/Workflow evaluator）。
- 现状：无 `BoundaryEvaluator` / `boundary-evaluator` 符号；现有边界提示仍为启发式 UI。
- 问题记录：无 evaluator 识别、触发纪律、结果落点（存哪、谁消费）均未定义。

## S9｜Legacy / Internal-only 接口收口

- 计划：清理 legacy / internal-only 接口，保留单一权威路径。
- 现状：未做接口 census；`packages/contracts/src/index.ts` 存在 legacy/INTERNAL 相关标记，范围未清点。
- 问题记录：
  1. 缺一份 legacy/internal 端点清单（谁在用、能否删、能否收敛）。
  2. S3 遗留：CLI 无 snapshot branch 命令（归本 Session 决定）。
  3. S1 遗留：`sessionId` 暂由 `run.queued` 事件 payload 承载，S9 需决定是否落正式字段。

## S10｜0.1 Golden Project E2E + Release Gate

- 计划：一条真实 0.1 用户链的 Golden Project E2E，S10 前禁止宣布 0.1 完成。
- 现状：`tests/e2e/golden-path.spec.ts` 是 B 阶段 golden path（SQLite→Proxy 链路），不是计划定义的 0.1 用户故事链。
- 问题记录：缺「用户工作→Context/Session/Handoff→召唤 Agent→执行→Proposal/Revision→重进继续」整链 E2E；Release Gate 未建立。

---

## 附：前端三 Pass 合入记录（2026-08-17）

- 已把 `HUABU_V2_PASS2` → `MATERIAL_DROP_PASS3` → `SEMANTIC_DROP_PASS4` 三个 patch 并入 worktree（`apps/web`），`npm install` 新增 5 个依赖（@base-ui/react、@pagus-kit/renderer、motion、react-pdf、sonner），0 vulnerabilities。
- 手动合并 3 处冲突（均因 worktree 已有未提交改动）：
  1. Pass2 × ProjectCanvas 工具条（保留我们加的 onContextMenu，并入对齐/分布/整理这些按钮）；
  2. Pass3 × AppShellView（并入 LcosToaster 两处挂载，保留 uiScale 内联变量）；
  3. Pass4 × semanticRightDrop / ProjectCanvas（接受 Pass4 新语义 Drop 架构：semanticDrop.ts 统一入口 + 兼容桥；原 self-removing 右键守卫被新架构替代，cancelSemanticDrop 的 300ms 兜底仍保留）。
- 验证：仅 `typecheck`（web）PASS。vitest/build/E2E 未跑（按指令省 token）。
- 给 GPT 的待办：跑全量检查链；真机验证 Edge 右键拖放（Pass4 只加了提示关闭「鼠标手势」，未从 JS 侧完全压制）；确认 Pass3 新依赖的渲染路径（react-pdf 等）在完整 monorepo 可用。
