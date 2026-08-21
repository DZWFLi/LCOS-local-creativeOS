# MVP Runtime Slice E Review

日期：2026-07-29  
分支：`codex/mvp-fast-build`  
实现基线：`c0e2b75 feat(runtime): ingest provider results as draft returns`

## 1. 任务摘要

Slice E0～E3 已完成：

```text
E0 Domain Guard
→ E1 Accept CAS
→ E2 Reject
→ E3 Retry New Run
```

本 Slice 将 Slice D 的 `Draft Revision + pending ArtifactReturn` 接入正式人工决策
生命周期。没有增加 Schema、依赖或 Provider，也没有导入 UI v0.7。

## 2. 变更流程

变更前：

```text
Provider review
→ Draft Revision
→ ArtifactReturn(pending_review)
→ Current 不变
```

变更后：

```text
Run Review Aggregate
├─ Accept(expectedBaseRevisionId)
│  → CAS
│  → old Current = superseded
│  → Draft = current
│  → Artifact.currentRevisionId = Draft
│  → Return = adopted
│  → Run = completed
├─ Reject
│  → Return = rejected
│  → Draft 保留为审计证据
│  → Current 不变
│  → Run = completed
└─ Retry
   → old Return = rejected
   → old Run = completed
   → new Run(status=created, retryOfRunId=old Run)
   → new Dispatch(status=planned)
```

## 3. E0 Domain Guard

以下通用写入路径不再允许改变 `Artifact.currentRevisionId`：

- Graph Mutation `upsert_artifact`；
- Graph Snapshot Save / Bootstrap 覆盖已有 Artifact；
- Artifact PUT 所使用的公共 Repository Upsert。

Current 只能由显式 Revision 生命周期推进：

- Import / Source Registration；
- Adopt External Change；
- Runtime Accept。

这关闭了 Slice D 审计登记的 P0 绕过路径。

## 4. E1 Accept CAS

Accept 必须提交 `expectedBaseRevisionId`，并在一个 SQLite
`BEGIN IMMEDIATE` 事务中验证：

- Return 仍为 `pending_review`；
- Return Base 与 expected base 一致；
- Artifact Current 仍等于 expected base；
- Base Revision 仍为 `current`；
- Returned Revision 仍为 `draft`；
- Draft parent 与 Run 身份一致。

任一条件不成立，整笔事务回滚，不产生部分状态。

成功后：

- Base Revision → `superseded`；
- Draft Revision → `current`；
- Artifact Current → Draft；
- Return → `adopted`；
- Run → `completed`；
- RuntimeBinding `finalizePending=true`；
- Project graphVersion 增加一次。

## 5. E2 Reject

Reject：

- Return → `rejected`；
- Draft Revision 保持 `draft`，作为可追溯 Evidence；
- Artifact Current 不变；
- Run → `completed`；
- RuntimeBinding `finalizePending=true`。

`rejected` 没有被错误加入 ArtifactRevision 状态。

## 6. E3 Retry

Retry 不把旧 Run 改回 `running`。它会：

- Reject 旧 Return；
- 完成旧 Run；
- 标记旧 RuntimeBinding 等待 Provider finalize；
- 创建新 Canonical Run；
- `retryOfRunId` 指向旧 Run；
- 创建新的 `RuntimeDispatch(planned)`；
- 新 Run 使用独立 `runId` 与 idempotency key；
- 可选替换 instruction，未提供时沿用旧 instruction。

Retry 当前复用不可变 ContextManifest 与 Target Base。若用户需要更换 Context，应先重新
构建 Manifest，再由后续 UI Integration Slice 扩展明确入口，不能修改旧 Manifest。

## 7. UI v0.7 接口预留

新增 `RunReview` 聚合读取：

- Canonical Run；
- RuntimeDispatch；
- RuntimeBinding；
- ArtifactReturns；
- Draft Revisions；
- UI `presentationPhase`；
- versioned Accept / Reject / Retry capability。

`review` 只由 Pending Return 推导为 UI Presentation Phase，没有加入 Canonical Run 状态。

Capability 使用：

```text
schemaVersion: 1
enabled: boolean
reason?: string
```

未存在 Pending Return 时能力关闭并返回
`no_pending_artifact_return`，前端不得静默显示假能力。

HTTP 入口：

```text
GET  /runs/:runId/review
POST /artifact-returns/:returnId/accept
POST /artifact-returns/:returnId/reject
POST /artifact-returns/:returnId/retry
```

## 8. 修改文件

- `packages/contracts/src/index.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/runtime-review-service.ts`
- `apps/local-core/src/server.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/runtime-review-service.test.ts`
- `apps/local-core/tests/runtime-result-ingestion.test.ts`
- `MVP_V1_EXECUTION_README.md`
- `docs/handoffs/MVP_RUNTIME_SLICE_E_REVIEW.md`

没有 Schema Migration，没有新增依赖，没有修改 lockfile，没有 Web UI 变化。

## 9. 测试

定向测试：

```text
Local Core 16 files / 113 tests PASS
```

`npm run check:fast`：

```text
Web unit          102 passed
Local Core unit   113 passed
Domain unit         5 passed
Contracts unit      4 passed
Architecture       27 passed
Typecheck            PASS
Build                PASS
```

新增覆盖：

- Review Presentation 与 Canonical Run 分离；
- Accept CAS 成功；
- stale / mismatched Accept 原子回滚；
- Reject 保留 Draft；
- Retry New Run / Dispatch / retryOfRunId；
- Restart Recovery；
- Generic Mutation Current Guard。

仓库既有 React hooks、unused expression 与 Import Copy regex 警告仍存在，本 Slice 未新增
lint error。

## 10. 风险与未完成

- `finalizePending` 已落库，但本 Slice 没有调用 Bridge `finalize_task_review`；
- 新 Retry Run 仅创建为 `planned`，不会在本 Slice 自动派发；
- UI v0.7 尚未导入或接线；
- 尚未做手工浏览器 Golden Path；
- 真实 Bridge Runtime 切换仍须另行批准；
- Retry 若需要新 Context，必须走新 Manifest 流程，不能改写旧 Manifest。

这些是后续集成工作，不影响 Slice E Canonical 生命周期成立。

## 11. 回滚

Revert Slice E 变更即可删除 Review/Decision 服务与 Guard。本 Slice 没有 Schema
Migration；已存在的 Slice D Draft / Return 仍可由旧版本读取。生产数据若已执行 Accept，
回滚代码不会自动逆转用户已经确认的 Revision 决策，数据级回滚应通过显式 Revision
操作处理，不能覆盖 Current。

## 12. 下一步

停止，等待批准后进入 UI v0.7 Integration Gate：

```text
选择性移植 App Shell / Components
→ 接入 RunReview
→ 删除 Prototype Runtime / Project Truth
→ 浏览器 Golden Path
→ 集中 MVP 验收
```
