# LCOS 0.1 · Codex 最小补件请求（S10 Release Gate）

## 任务性质

不要重新设计 S4–S9，不要再开新架构。

GPT 已经在上传全栈包上完成 S2 遗债修复与 S4–S9 产品化补洞，并建立 S10 deterministic/release gate。

你现在只做：

> **把 PASS5 patch 应用到真实完整 worktree → 安装/确认依赖 → 修复真实 Gate 暴露的问题 → 跑一条 fresh REAL Codex Harness Golden Project → 回填 evidence。**

## 输入

应用：

`LCOS_FULLSTACK_PRODUCTIZATION_PASS5_20260817.patch`

如果 patch 与当前 worktree 有冲突：

- 优先保留当前正确业务代码；
- 逐文件人工合并 PASS5 的产品化语义；
- 不允许因为冲突而静默丢掉 S2/S4–S10 任一链。

## Session C1｜Apply + Baseline

1. 记录：branch / HEAD / dirty state。
2. 应用 PASS5 patch。
3. `npm ci`。
4. 确认 Web / Local Core / Contracts / Domain workspace dependencies 完整。
5. 不做无关重构。

## Session C2｜Deterministic Gate

执行：

```bash
npm run check:0.1:deterministic
```

该命令会依次跑：

- lint
- typecheck
- unit/contract tests
- architecture tests
- integration tests
- Local Core build
- Web production build
- browser E2E
- full deterministic golden path

任何 FAIL：

- 只修真实根因；
- 补相应 regression test；
- 重新从失败项开始跑，最终必须整条 PASS。

重点关注本轮新增：

- `tests/e2e/context-create-from-selection.spec.ts`
- ImportBatchRef schema migration v36
- Context local Agent session/resume
- Context Proposal producer
- Feedback → Revision Upgrade
- Boundary Evaluator
- CLI snapshot commands

## Session C3｜Fresh REAL Codex Harness Golden Project

这一步**禁止 scripted/mock worker**。

必须使用真实 `codex` provider process，完整验证：

1. 打开真实 Project。
2. GUI 创建/进入 Context。
3. Context 内召唤局部 Agent Node。
4. 同一个 LCOS Session 执行 Run #1。
5. Run #1 读取局部 Context，并通过 `propose_lcos_context_change` 产生 Proposal。
6. GUI 审查 Proposal，至少完成 Keep / Reject；若 Modify，应生成新 Proposal。
7. 同 Session 启动 Run #2，真实 create/revise。
8. 真实 Bridge/Harness 返回 ArtifactReturn。
9. GUI Accept ArtifactReturn。
10. 从 Agent 结果发起 Feedback → Revision Upgrade。
11. 验证 Session Summary + Handoff 进入 Context History。
12. 关闭并重新打开，Continuity resume 回到同一 Session。
13. reload 后确认“从选择沉淀上下文”创建的 Context 仍存在。

## Session C4｜Evidence

复制：

`docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE_TEMPLATE.md`

为：

`docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE.md`

严格填写所有 marker，尤其：

```text
REAL_HARNESS_VERDICT: PASS
PROVIDER: codex
REAL_PROVIDER_PROCESS: true
SCRIPTED_OR_MOCK_WORKER: false
HEAD: <current HEAD>
PROJECT_ID: ...
SESSION_ID: ...
RUN_1_ID: ...
RUN_2_ID: ...
CONTEXT_PROPOSAL_ID: ...
ARTIFACT_RETURN_ID: ...
FEEDBACK_ARTIFACT_ID: ...
SESSION_SUMMARY_ID: ...
HANDOFF_ID: ...
CONTINUITY_RESUME: PASS
GOLDEN_USER_STORY: PASS
```

最后执行：

```bash
npm run check:0.1:release
```

只有这条 PASS，才能写：

`LCOS 0.1 Candidate = PASS`

## 禁止事项

- 不要用 `scripts/full-golden-path.mjs` 的 scripted worker 冒充真实 Codex evidence。
- 不要伪造 ID。
- 不要跳过 Browser E2E。
- 不要因为 S10 Gate 暴露问题而顺手重做 UI/架构。
- 不要新增第二套 Context Proposal / Import Batch / Boundary Hint truth。
- 不要把 `runs.sessionId` 直接加成第二份 session truth；PASS5 的 S9 决策是 0.1 暂不加正式字段。
- 不要在 Gate 未全 PASS 时宣布“主体完成”。

## 返回给 GPT 的最小材料

只需要返回：

1. 应用后的完整 worktree zip 或增量 patch；
2. `docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE.md`；
3. deterministic + release gate 最终输出摘要；
4. 若仍有 FAIL，附最小 reproduction 与对应日志。
