# LCOS 0.1｜接口产品化收口 Codex 施工安排

**日期：** 2026-08-16
**施工性质：** B 阶段完成后的 0.1 收口，不开启正式 C，不新增产品世界观
**冻结基线：** `LCOS_FULLSTACK_B-CLOSED_CONVERGENCE_20260816`

## 0. 本轮目标

本轮不是继续“加功能”，而是把已经存在的 B3-B6 / C-Early 后台能力，收成一条真实、自然、可验证的 0.1 用户链。

最终目标只有一个：

```text
用户在真实项目中工作
→ LCOS 保留 Project Truth / Context / Session / Handoff
→ 用户显式召唤 Agent
→ 一个真实 Harness 接收正确上下文并执行
→ 结果回到 LCOS
→ Proposal / Keep / Revert / Revision 能被自然使用
→ 下次重新进入项目时能继续
```

**禁止把“接口存在”继续冒充“产品完成”。**

---

# 1. 冻结基线：这些已经完成，不得借施工重做

以下能力按当前实现继续保留，本轮不得重写世界观或重新做第二套：

- B4：WorkState / Intent Resolver / Attention / Context Composer / Skill Routing
- B5：ChangeSet / Undo / Relation / Feedback → Revision
- B6：Resolver / Session Binding / Resume / Attach / Return
- R17：Project Realtime Runtime / 单项目事件流
- B 阶段收敛补丁：AI 入口、Intent/Skill UI、Workflow 语言、source-first 文件夹导入、Sidecar 收口、边界提示

以下产品原则视为冻结：

```text
AI 是 LCOS 的能力，不是 LCOS 的界面。
流程是工作历史的沉淀结果，不是进入工作的方式。
Context 关心什么值得记住。
Workflow 关心什么值得复用。
主画布负责工作，平时保持安静。
```

当前 `SurfaceAgentNode` 仍然只能存在于 Context / Workflow，主画布不恢复 Agent Node。

---

# 2. 本轮严禁扩张的正式 C 范围

本轮明确禁止：

- 同时接 Codex / Claude Code / DeepSeek / Pi 多 Harness
- Browser Profile / Auth / Cookie / Token Runtime
- Browser Automation / Tab Restore / Full Browser Session Restore
- 新建完整执行事件协议
- Tool Permission Runtime
- 子 Agent Runtime
- 新建 Project Memory Graph / Memory UI / Memory DB
- CRDT / 多人云协作
- 为现有内部接口补新的管理页面
- 新建第二套 Chat / Prompt / Agent 面板
- 新建第二套 Continuity DB
- 新建第二套 Harness Framework

如果施工中发现上述需求才能“顺便完成”，立即停止该方向，记录为 C 阶段 backlog，不实施。

---

# 3. 全程施工纪律

每个 Session 必须独立完成以下闭环：

```text
Read
→ Audit current consumer / data path
→ Implement the smallest authoritative path
→ Add/adjust tests
→ Run relevant tests
→ Manual smoke when UI is touched
→ Compare against Done / Acceptance checklist
→ Fix every discovered debt in current Session
→ Write handoff
→ STOP
```

严禁：

- “主体完成，细节下一轮”
- “接口已存在所以算完成”
- “静态合同 PASS 所以浏览器链路默认 PASS”
- Handoff 中隐藏未完成项
- 未完成本 Session Acceptance 就进入下一 Session
- 为赶进度留下双路径 / fallback 真相源

任何 Session 出现 blocker：

1. 保留失败证据；
2. 不污染后续依赖链；
3. 能独立验证的其它项可继续验证；
4. 最终状态必须明确写 `PASS / PARTIAL / FAIL / UNREACHABLE`；
5. `PARTIAL` 不允许被写成 Done。

---

# 4. Session 0｜真实工程基线 Gate + Consumer Census

## 目标

先确认 `B-CLOSED-CONVERGENCE` 在真实开发环境没有被静态合同掩盖的工程红项，并建立本轮需要接实/清理的 consumer 清单。

## 只读审计

至少核对：

- 当前 branch / HEAD / worktree dirty state
- `continuityResolve / bind / resume / attach / return` 的所有 consumer
- Session Summary / Handoff 的 producer / consumer
- Context Snapshot create / compare / branch 的 GUI / CLI / Core 路径
- `prepareRevisionWorkflow()` consumer
- `proposeContextChange()` consumer
- `SurfaceAgentNode` 当前 context capture / session / result projection
- Import / Upload provenance 中可复用的 batch/session 标识
- Boundary hint 当前 heuristic / Utility Model 接线
- `setAttentionIntent`
- `dismissContinuityCandidate`
- `validateAgentPlan`
- legacy `streamPresentation / streamActiveContext / streamProjectPresentations`
- `artifactSearch / affinityResolve / exportLcosproj / inspectLcosproj / openLcosproj`

## 必跑 Gate

在真实依赖环境执行项目已有正式命令。至少覆盖：

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:architecture
npm run test:integration
npm run build
npm run test:e2e
```

若仓库脚本名不同，以 package.json 真实命令为准，不得伪造 PASS。

## Done

- 完整工程 Gate 有真实结果
- Consumer census 完成
- 所有本轮目标接口明确标为：`real consumer / missing consumer / legacy / internal-only`
- 没有开始正式 C 功能

## Acceptance

- 任一红项都记录到具体 test / file / route
- 不允许只引用之前 `173/173 static PASS`
- 输出 `SESSION_0_BASELINE_AND_CONSUMER_CENSUS.md`

完成后 STOP。

---

# 5. Session 1｜Continuity 真 Harness 主链：只接 Codex

## 问题

当前存在两条并行链：

```text
真实 Run：
createRuntimeRun
→ ContextManifest
→ dispatchRuntimeRun
→ Light Bridge
→ ArtifactReturn
```

以及：

```text
Continuity：
Resolve
→ Bind
→ Attach
→ Return
```

合同完整，但真实 Agent 主链没有统一消费 Continuity。

## 目标

只选择 **Codex** 作为 0.1 真实 Harness，把 Continuity 变成一次真实执行链：

```text
Project Resolve
→ Continuity Session Bind
→ Continuity Attach Bundle
→ Codex execution
→ Continuity Return Intake
→ Artifact / Session Summary / Handoff / Session Context
```

## 实施原则

- 优先适配现有 `RuntimeAdapter / Light Bridge / ArtifactReturn`
- 不新建 Harness Framework
- 不复制一套 ContextManifest
- `Attach Bundle` 必须成为真实 Codex 输入链的一部分，不是仅供 debug 输出
- Return 必须走 authoritative intake，不允许 GUI 自己拼装结果
- 保留现有 Project Event Runtime

## 必测

1. explicit project resolve
2. session project affinity resolve
3. bind 后 attach 能得到同一 project/session
4. Codex 确实收到 Attach Bundle 中的项目上下文
5. 执行后 Return Intake 成功
6. Artifact Return 可见
7. Session Summary / Handoff 被真实创建
8. retry / failed run 不产生伪成功 handoff
9. reload 后 continuity resume 仍能找到正确 session

## Done

至少一个真实 Codex Run 完整跑通上述链路。

## Acceptance

- 不允许 Continuity 只在 CLI 测试里 PASS
- 不允许真实 Web Run 继续完全绕开 Attach / Return
- 不允许为 Codex 新增 LCOS 专属第二套 session truth
- 输出 `SESSION_1_CODEX_CONTINUITY_E2E.md`

完成后 STOP。

---

# 6. Session 2｜Session Summary / Handoff 进入 Context History

## 问题

数据已经被创建，但普通用户几乎看不到，`contextSurfaceRuntime.handoffs` 仍存在固定空数组路径。

## 目标

不做 Handoff 管理后台。

把 Handoff / Session Summary 变成 Context 的真实历史与沉淀来源：

```text
Agent Return
→ Session Summary / Handoff
→ Context History
→ Context Deposit Candidate source
```

## UI 原则

Context 中用户至少能理解：

- 上次 Agent / Harness 做了什么
- 留下了哪些决定 / 未解决项
- 返回了哪些 Artifact
- 对应哪个 Session / 时间

不需要暴露 provider runtime 内部细节。

## 必测

- Session 1 创建的真实 Handoff 能在 Context History 看到
- reload 后仍可见
- 无 handoff 时无空壳卡片
- Handoff 可作为 Context Deposit Candidate source
- 删除 / 生命周期遵循现有 Core truth，不在前端自造副本

## Acceptance

- `handoffs: []` 之类硬编码空 projection 被消除
- 不新增独立 Handoff 页面
- 输出 `SESSION_2_HANDOFF_CONTEXT_HISTORY.md`

完成后 STOP。

---

# 7. Session 3｜Context Snapshot Branch 收成 Core 单一路径

## 问题

Core 已有 snapshot branch API，但 GUI 的“从历史建立 Workspace”在前端手工重建，形成双真相路径。

## 目标

冻结：

```text
Context History Branch
→ Core authoritative branch
```

GUI / CLI / Agent 最终必须共享同一 branch 语义。

## 实施

- GUI 改为调用现有 Core `branchContextSnapshot`
- 删除或降级 App.tsx 中重复的 local branch reconstruction
- branch 后 Workspace / member refs / provenance / relation 行为由 Core 决定
- 不新增 schema，除非审计证明当前 API 无法表达既有语义；若必须迁移，先停下报告

## 必测

- snapshot create
- compare
- branch
- branch 后 reload
- CLI 与 GUI 对同一 snapshot 产生一致结果
- branch 不修改原 snapshot / Context

## Acceptance

- 不再有两个 branch truth source
- 输出 `SESSION_3_CONTEXT_SNAPSHOT_AUTHORITATIVE_BRANCH.md`

完成后 STOP。

---

# 8. Session 4｜SurfaceAgentNode 变成真正局部 Agent

## 问题

当前 Node 更接近“空间化 Prompt Launcher”：

- 有 Selection 就吃 Selection
- 无 Selection 就吃整个 Context / Workflow Presentation
- 没有真正冻结空间邻域
- 回复不会回到 Node

## 目标

0.1 只做最低可用局部 Agent，不做完整 Chat Thread。

Node 创建时冻结：

```text
Selection
+
local spatial neighbourhood
+
Pinned / relevant local refs
+
current Surface identity
```

Node 生命周期内：

- 保持同一 Continuity Session ID
- 显示最近一次 Agent reply / result summary
- 支持连续追问
- 切换 Surface 仍按当前 Presentation-only 规则清理
- Keep / Revert 继续走 B5 Proposal / ChangeSet

## 邻域规则

必须是确定、可测试、有限的局部采样。不要直接把整个 Presentation 作为“空间邻域”。

优先复用现有 geometry / Presentation refs / Attention evidence，不新增 Spatial Memory 系统。

## 必测

- 无 Selection 时，附近材料进入 context，远处材料不进入
- 有 Selection 时 Selection 优先，但仍可携带必要局部 refs
- 移动 Agent Node 后，新建 Node 的 neighbourhood 不串
- 同一 Node 多轮追问 session 连续
- reply summary 回到正确 Node
- 多个 Node 不共享错误 session

## Acceptance

- Node 不成为 Project Entity
- 主画布仍不能创建 Agent Node
- 不做完整聊天历史 UI
- 输出 `SESSION_4_LOCAL_AGENT_NODE.md`

完成后 STOP。

---

# 9. Session 5｜Context Agent Node 成为 Proposal Producer

## 问题

Context Proposal 的 Core / CLI / MCP / Preview / Keep / Revert 已经存在，但普通 GUI 的 Agent Node 目前不会自然调用 `proposeContextChange()`。

## 目标

当 Context Agent Node 判断需要修改 Context membership / relation 时：

```text
Agent reasoning/result
→ proposeContextChange
→ Context Preview
→ user Keep / Reject
→ ChangeSet
```

绝不直接修改 Project Truth。

## 实施

- 接通 SurfaceAgentNode → Proposal producer
- 只在存在真实结构修改意图时产出 Proposal
- 普通问答 / 分析不制造空 Proposal
- Proposal payload 必须包含可解释的 add/remove/change refs
- Keep / Revert 复用现有 B5 mutation safety

## 必测

- “把这三份材料加入这个 Context”产生 Proposal
- Preview 正确
- Reject 无 mutation
- Keep 正确 mutation
- Revert 正确
- 普通提问不产生 Proposal
- stale / changed member 下 safe revert 不误删新修改

## Acceptance

- `Agent 修改建议（0）` 不再因为没有 producer 而永久为空
- 不新增另一套 proposal schema
- 输出 `SESSION_5_CONTEXT_AGENT_PROPOSAL_LOOP.md`

完成后 STOP。

---

# 10. Session 6｜ImportBatchRef：让 Agent 真正理解“刚导入这一批”

## 问题

source-first 已正确取消 Folder Entity，但因此缺少轻量“这批导入内容”的引用。

## 目标

不要恢复 Folder Entity。

复用现有 Import / Upload Session / provenance，形成：

```text
ImportBatchRef
```

它只是一种临时 / provenance ref，可 Resolve 到实际文件列表。

用户自然语言：

```text
整理刚刚导入的这一批
```

应能变成：

```text
ImportBatchRef
→ file refs
→ Agent context
→ Reorganize Proposal
→ Preview / Apply
```

## 必测

- 一次多文件/目录导入形成稳定 batch ref
- observedPath 保留
- batch ref 不成为 Folder / Collection / Workspace ontology
- 第二次导入不会覆盖第一次 batch identity
- Agent 能准确 resolve “刚刚导入这一批”
- Proposal 才能创建 Collection / Context / Scene / Relation

## Acceptance

- 不恢复目录树自动语义映射
- 不要求用户手动全选几十个文件才能告诉 Agent“整理这批”
- 输出 `SESSION_6_IMPORT_BATCH_AGENT_CONTEXT.md`

完成后 STOP。

---

# 11. Session 7｜Feedback → Revision 只作为结果升级

## 问题

`prepareRevisionWorkflow()` 存在，但收敛后没有自然 UI consumer。

这是正确的半成品：不能恢复固定“建立修改请求”流程按钮，但必须给真实工作一个升级为 Revision 的出口。

## 目标

只有工作已经发生，并满足修订证据时，才轻提示：

```text
这次修改包含多条反馈 / 明确保留项 / 多对象影响 / 新版本
→ 是否保留为一次修订记录？
```

用户 Keep 后才调用：

```text
prepareRevisionWorkflow()
```

## 触发原则

- 不是每次修改都提示
- 不是 Selection 变化就提示
- 不把 Revision 变成工作入口
- 必须有真实 ChangeSet / feedback / result evidence

## 必测

- 单次微调不提示
- 多反馈 + 新版本可提示
- 用户忽略后不自动生成 Revision
- Keep 后 Revision 与相关 ChangeSet / Artifact / Decision refs 正确绑定
- reload 后历史正确
- Revert 不破坏后续版本

## Acceptance

产品语义必须保持：

```text
先工作
→ 再决定是否把这次工作沉淀为 Revision
```

不得变回：

```text
先创建 Revision Workflow
→ 才允许开始修改
```

输出 `SESSION_7_REVISION_RESULT_UPGRADE.md`。

完成后 STOP。

---

# 12. Session 8｜Boundary AI Evaluator：把启发式升级为低频真实判断

## 问题

当前 Context / Workflow 沉淀候选 UI 已有，但判断仍偏粗：

- Context 更多是在说“这条对话存在”
- Workflow 可能因 `items.length >= 2` 就认为出现方法

## 目标

复用 B4 Utility Model，只增加两个低频 evaluator：

```text
ContextDepositEvaluator
WorkflowPatternEvaluator
```

不新增 AI Runtime。

## Context evaluator 识别

- 稳定事实
- 明确约束
- 决策
- 高价值结论
- 已反复引用的参考
- Session Summary / Handoff 中值得长期保留的信息

## Workflow evaluator 识别

- 重复动作模式
- 重复判断链
- 稳定操作顺序
- 重复 Skill 组合
- 多次 Run / Conversation / ChangeSet 中被证明的方法

## 触发纪律

仍然严格遵守已有边界：

```text
Context：20min cooldown + new evidence + confidence + user not busy
Workflow：4h cooldown + repeated pattern + confidence + user not busy
```

不得恢复 Selection / Drop / Surface changed 即时建议。

## 必测

- 时间满足但无新证据：不提示
- 有新证据但低置信度：不提示
- Context 能抽出“内容中的稳定结论”，不是只列会话标题
- Workflow 必须有真正重复模式，不因两条无关记录触发
- evaluator 失败时静默降级，不阻断用户工作
- 用户未接受前不修改 Project Truth

## Acceptance

- 不新增 Memory Graph
- 不做常驻 AI 建议
- 输出 `SESSION_8_BOUNDARY_EVALUATORS.md`

完成后 STOP。

---

# 13. Session 9｜Legacy / Internal-only 接口收口

## 目标

防止后续开发者把已经废弃的产品语义重新接回来。

基于 Session 0 consumer census，逐项决定：

### Internal-only / debug

- `setAttentionIntent`
- 必要的底层 Intent / Skill inspection

不得补用户 UI。

### Evaluate merge/remove

- `dismissContinuityCandidate`
- `validateAgentPlan`

如果新主链没有 consumer：

- merge 到 authoritative path；或
- 标 deprecated / internal；或
- 安全删除 Web 暴露。

### Legacy SSE

- `streamPresentation`
- `streamActiveContext`
- `streamProjectPresentations`

若兼容期结束，删除或明确 deprecated，正式路径继续只有：

```text
streamProjectEvents
```

禁止复活多 SSE 连接池问题。

### 老辅助接口

逐项 consumer census：

- `artifactSearch`
- `affinityResolve`
- `exportLcosproj`
- `inspectLcosproj`
- `openLcosproj`

GUI 不再消费的接口不得为了“完整”而补入口。

## Acceptance

- 每个接口有明确 disposition：`keep internal / merge / deprecate / remove`
- 删除前有 consumer 证明
- 不破坏 CLI / installer / file association 等真实用途
- 输出 `SESSION_9_INTERFACE_CLEANUP.md`

完成后 STOP。

---

# 14. Session 10｜0.1 Golden Project E2E + Release Gate

这一 Session 才允许判断是否进入 0.1 候选。

## Golden Project 必须覆盖的真实故事

使用一个真实复杂项目，不用 toy fixture 代替主证据：

```text
1. 创建 / 打开项目
2. 导入本地目录与文件
3. observedPath / ImportBatch provenance 正确
4. Main Canvas 正常工作
5. 创建 / 使用 Context
6. 在 Context 放置局部 Agent Node
7. Agent Node 使用局部 neighbourhood
8. 通过 Codex Continuity Attach 执行一次真实工作
9. Return 回 LCOS
10. Session Summary / Handoff 出现在 Context History
11. Agent 提议修改 Context membership
12. Preview → Keep
13. ChangeSet 可 Revert
14. 将一次真实反馈修改升级为 Revision
15. Context Snapshot → Core branch → Workspace
16. 重新打开项目
17. Resume 恢复正确 Scene / WorkState / Context
18. 进入 Context 时低频沉淀候选正确
19. Workflow 只在真实重复方法存在时提示
20. 多标签 / Sidecar / Realtime 不产生伪冲突或丢状态
```

## 必测真人项

这些首先是 Gate，不是继续开发理由：

- Sidecar 360 / 390 / 420 / 480px
- Agent Node 空间手感
- Context 20min / Workflow 4h / Main idle 30min 节奏
- 右键菜单三 Surface 归位
- Semantic Drop 鼠标手感
- Native Explorer / OLE 拖入
- Browser Extension 真机加载
- R17 leader takeover / multi-tab 长时间运行

如果真人测试发现产品问题：

- 优先修交互 bug / wiring bug
- 不借机扩正式 C
- 不新增平行产品概念

## Final Engineering Gate

重新执行完整：

```text
lint
semantic typecheck
unit
architecture
integration
build
Playwright / E2E
Golden Project manual evidence
```

## Release Acceptance

只有全部满足才可写：

```text
LCOS 0.1 Candidate = PASS
```

否则必须写：

```text
BLOCKED
```

并列出阻断项。

不得写“基本完成”“主链完成”“可视为完成”。

---

# 15. 每个 Session 的统一 Handoff 模板

Codex 每次停止前必须提交：

```markdown
# Session X Handoff

## Goal

## Baseline
- branch:
- HEAD:
- dirty files before:
- dirty files after:

## Files changed

## Authoritative path after this session

## Tests actually run
- command
- result
- evidence

## Manual smoke actually run

## Acceptance checklist
- [x] ...
- [ ] ...

## Remaining debt discovered in this Session

## Explicitly not done

## Risk / rollback point

## Verdict
PASS / PARTIAL / FAIL / UNREACHABLE
```

如果 Acceptance 仍有 `[ ]`，Verdict 不得为 PASS，并且不得进入下一 Session。

---

# 16. 最终施工顺序

严格按依赖关系：

```text
S0  工程 Gate + Consumer Census
↓
S1  Codex Continuity 真 Harness 主链
↓
S2  Handoff / Session Summary → Context History
↓
S3  Context Snapshot → Core authoritative branch
↓
S4  Agent Node 真局部上下文 + Session + Reply Summary
↓
S5  Context Agent Node → Proposal Producer
↓
S6  ImportBatchRef → Agent Reorganize Proposal
↓
S7  Feedback / ChangeSet → Revision 结果升级
↓
S8  Context / Workflow Boundary AI Evaluator
↓
S9  Legacy / Internal-only 接口收口
↓
S10 Golden Project E2E + Release Gate
```

其中：

- S3 与 S4 在代码依赖上可相对独立，但默认仍按顺序执行，减少并行污染。
- S4 必须先于 S5。
- S1 必须先于 S2，确保 Context History 接的是实际 Return 产生的真实数据。
- S10 前禁止宣布 0.1 完成。

---

# 17. 给 Codex 的开工指令

从 **Session 0** 开始。

不要直接连续执行 S0-S10。

本轮先完成：

```text
Session 0｜真实工程基线 Gate + Consumer Census
```

完整对照 Done / Acceptance，自检无欠账后生成：

```text
SESSION_0_BASELINE_AND_CONSUMER_CENSUS.md
```

然后停止，汇报：

- branch / HEAD
- 当前 worktree 状态
- 全工程 Gate 真实结果
- consumer census
- 发现的 blocker
- Session 1 是否仍可按本计划直接施工

**未经下一步指令，不要自动进入 Session 1。**
