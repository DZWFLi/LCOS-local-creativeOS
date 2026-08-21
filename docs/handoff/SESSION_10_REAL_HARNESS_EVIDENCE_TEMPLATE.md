# SESSION 10 · Real Harness Evidence Template

> 这份文件只用于 **真实 Codex provider / 真实 LCOS runtime** 的最终 0.1 Release Gate。
> scripted worker、mock provider、伪造 run id 都不能替代。

复制本文件为：

`docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE.md`

并填写以下机器可读 marker。marker 名称不要改。

```text
REAL_HARNESS_VERDICT: PASS
PROVIDER: codex
REAL_PROVIDER_PROCESS: true
SCRIPTED_OR_MOCK_WORKER: false
HEAD: <git rev-parse HEAD>
PROJECT_ID: <real project id>
SESSION_ID: <same local continuity session id>
RUN_1_ID: <real local Context Agent run>
RUN_2_ID: <real create/revise execution run>
CONTEXT_PROPOSAL_ID: <proposal produced through propose_lcos_context_change>
ARTIFACT_RETURN_ID: <real ArtifactReturn accepted through review>
FEEDBACK_ARTIFACT_ID: <managed feedback artifact used for revision upgrade>
SESSION_SUMMARY_ID: <summary written for the session>
HANDOFF_ID: <handoff written for the session>
CONTINUITY_RESUME: PASS
GOLDEN_USER_STORY: PASS
```

## 必须验证的真实用户故事

1. 打开一个真实 Project，并在 GUI 中建立/进入一个 Context。
2. 在 Context 内召唤局部 Agent Node。
3. Agent 使用真实 Codex provider，沿同一个 LCOS Session 执行 Run #1。
4. Run #1 读取当前局部 Context，并通过 `propose_lcos_context_change` 产生 Context Proposal。
5. 用户在 GUI 审查 Proposal，至少执行一次 Keep / Reject；若执行 Modify，应产生新 Proposal 而不是改写旧 Proposal Truth。
6. 在同一个 Session 中启动真实 Run #2（create 或 revise），经过 Bridge / Harness，产生真实 ArtifactReturn。
7. 用户 Accept ArtifactReturn，结果成为当前 Revision。
8. 从该 Agent 结果进入 Feedback → Revision Upgrade，产生 managed Feedback，并启动下一轮 revision workflow。
9. 确认 Session Summary 与 Handoff 已进入 Context History。
10. 关闭并重新打开项目/会话后，从 Continuity 恢复到同一 Session，确认前序 Context、Proposal、Run、ArtifactReturn、Feedback、Handoff 都仍可追溯。
11. 重新加载 GUI，确认“从选择沉淀上下文”的 Context 仍存在。

## 证据要求

至少附：

- `codex --version` / provider executable 路径；
- branch、HEAD、worktree dirty state；
- 上述 ID 对应的 Core/API 查询输出摘要；
- Run #1、Run #2 的关键事件链；
- Context Proposal 审查结果；
- ArtifactReturn Accept 结果；
- Feedback Revision Upgrade 结果；
- Session Summary / Handoff 查询结果；
- 重启后的 Continuity resume 结果；
- `npm run check:0.1:deterministic` 完整 PASS 结果。

## 禁止替代

以下不能作为 Release evidence：

- `scripts/full-golden-path.mjs` 中的 scripted agent；
- mock provider；
- 手工写入 SQLite 的假数据；
- 只跑 API、不经过真实 provider process 的测试；
- 只提供截图，不提供可追溯 ID；
- 旧 commit / 旧 HEAD 的 evidence。
