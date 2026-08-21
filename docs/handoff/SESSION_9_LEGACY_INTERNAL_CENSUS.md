# Session 9 Handoff｜Legacy / Internal-only 接口收口

## Verdict

**PASS（代码侧收口 + 明确保留策略）**

S9 的目标不是把所有旧接口一把删光，而是停止双重权威路径，并给每一条兼容接口明确寿命/consumer。0.1 不为“看起来干净”破坏旧项目、CLI、Bridge 兼容。

## Authoritative paths after S9

| 能力 | 0.1 权威路径 | Legacy / internal 处理 |
|---|---|---|
| Web 项目实时同步 | `streamProjectEvents()` | `streamPresentation` / `streamProjectPresentations` / `streamActiveContext` 标记 deprecated；无 Web consumer，不再新增调用。Core route 暂留兼容。 |
| Web Agent 计划 | `proposeRun()` → Run / Review | `validateAgentPlan()` 仅 CLI/Agent 显式校验用途；Web 方法标 deprecated。 |
| Attention | Selection / Pin / Scene → rule evidence；S8 Boundary Evaluator 只在低频 eligibility 后调用 | `setAttentionIntent` / `dismissContinuityCandidate` 无 0.1 GUI consumer，标 internal/debug，不作为产品入口。 |
| Context Snapshot Branch | Core `/context-snapshots/:id/branch` | GUI 已走 Core；本 Session 新增 CLI `context snapshot-branch`，不再存在 CLI 缺口。 |
| Project Graph mutation | `POST /projects/:id/graph` MutationBatch | `SaveProjectGraphInput` / PUT graph 只保留 bootstrap/import/recovery/test；普通运行时编辑禁止走全量 snapshot save。 |
| Bridge dispatch | `bridge-task-v1` | `bridge-task-v0` 只读/测试兼容；Light Bridge 已明确禁止新建 v0。 |
| Intelligence | `IntelligenceProviderService` | `LocalIntelligenceService` / `localIntelligenceService` 只是一版兼容 alias，禁止新 consumer。 |
| Continuity session truth | `session_context_refs` + provider/session binding + Continuity service | **0.1 不给 `Run` 增加 `sessionId` 正式字段**。`run.queued` payload 只做审计链接，不成为第二套 session truth。 |

## `run.sessionId` 决策

S1 的遗留项在这里正式关闭：**0.1 不新增 `runs.session_id`。**

理由：

1. Session 的事实源已经是 `session_context_refs` / Continuity binding；
2. Run → session 的绑定只在执行/审计时需要，当前 `run.queued` event 已能追溯；
3. 再给 `Run` 表加一个可独立更新的 `sessionId` 会产生双重 truth 和迁移成本；
4. 若后续出现高频“按 session 查询 runs”的真实需求，应新增规范化 linkage/read-model，而不是让两个字段互相猜谁是真的。

## CLI snapshot branch

本 Session 已补：

```text
lcos context snapshot-list <project-id> [--workspace]
lcos context snapshot-create <project-id> --label "..." [--workspace]
lcos context snapshot-compare <project-id> <snapshot-id> <other>
lcos context snapshot-branch <project-id> <snapshot-id> --label "..." [--scope]
```

CLI 与 GUI/Agent 现在共享同一个 Core branch 端点。

## 保留而不删除的兼容项

### `SaveProjectGraphInput`

仍有 `RuntimeBridge.#bootstrapProject()` / import/recovery/test consumer，因此不是死代码。保留，但普通用户编辑的权威路径仍是 MutationBatch。

### `LegacyBridgeTaskEnvelopeV0`

Light Bridge 仍需要读取历史任务/fixtures；新 Runtime dispatch 使用 V1。删除会破坏恢复与旧证据，不属于 0.1 收口收益。

### `LocalIntelligenceService`

只剩 compatibility alias + tests。保留一版，禁止新 consumer；后续 major cleanup 可移除。

## 明确不再扩展的 Web client 接口

以下方法保留兼容实现，但已在类型层标 `@deprecated`：

- `streamPresentation`
- `streamProjectPresentations`
- `streamActiveContext`
- `setAttentionIntent`
- `dismissContinuityCandidate`
- `validateAgentPlan`

删除 Core route 需要单独做外部 CLI/MCP/旧客户端兼容审计，**不在 0.1 release closeout 中冒险做破坏性删除**。
