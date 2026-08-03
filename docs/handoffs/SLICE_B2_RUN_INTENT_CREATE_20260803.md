# Slice B-2 Handoff：create 多文件 Return Group 真实路径

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commit：`3effe0e`

## Decision

Slice B 第二步完成：create 从「保留明确错误、不支持多文件」改为真实 Return Group 路径——一个 Run 可返回 1–5 个新文件，每个文件独立登记 FileRecord + Artifact + Draft Revision + ArtifactReturn，全部进入 Review 投影，逐项 Accept 后提升为新 Artifact 的 Current Revision。直接对应工作单 RUN-03（create 支持 1–N 新 Artifact）与验收条件 4（create 可返回至少两个新 Artifact）。

## Exact files

- `packages/contracts/src/index.ts`：`AcceptArtifactReturnResult.previousRevision` 改为可选（新建 Artifact 无前驱 Revision）
- `apps/local-core/src/metadata-repository.ts`：
  - 新增 `createRuntimeCreatedArtifact()`：新建 Artifact 的原子登记（FileRecord + Artifact + Draft Revision + Return），带不变式校验与幂等重放
  - `acceptArtifactReturn()` 新增新 Artifact 接纳分支：结构判别（Artifact 无 currentRevisionId + baseRevisionId 指向自身 Draft + Draft 无 parentRevisionId），提升 Current、置 Return adopted、Run completed、Binding finalize_pending、graph_version+1；老 revise CAS 路径保持不变
- `apps/local-core/src/runtime-result-ingestion.ts`：`IngestedRuntimeResult` 增加 `create` 分支；create 要求 1–5 个 changed files 且全部 `action: 'created'`；每个文件校验隔离（stagingRoot 内）、哈希、按扩展名映射 Artifact kind/MIME
- `apps/local-core/src/runtime-adapter.ts`：create 的 Task 合同 expectedOutputs=[]、outputPolicy { allowZeroFiles:false, allowAdditionalFiles:true, maxFiles:5 }；契约类型放宽（内核早已支持 boolean/5）
- `apps/local-core/tests/runtime-create-ingestion.test.ts`（新增 8 例）

## Schema

无迁移。`artifact_returns` 现有结构已支持新 Artifact（baseRevisionId 指向自身 Draft）；复用现有 v7 Schema。

## Before / After flow

```text
Before: create 被 Adapter 预声明一个 Markdown 输出；Ingestion 只接受恰好一个文件；
        多文件返回直接 CONTRACT_UNSUPPORTED
After:  Web 选择 create → Adapter 开放合同（≤5 文件、无预声明输出）
        → Provider 返回 1–5 个 created 文件
        → Ingestion 逐个登记新 Artifact + Draft + Return（pending_review）
        → Review 投影展示全部 Return → 逐项 Accept 提升 Current / 完成 Run
```

## Security impact

- create 返回值仍强制隔离在 `runtimeRoot/staging` 内（realpath + assertContained），越界即 RESULT_PATH_REJECTED
- 新建文件不移动原文件，只登记引用；哈希校验后再入库
- 同一结果重放幂等，不重复登记

## Failure recovery

- create 返回 0 或 >5 文件 → 明确错误，不落任何 Draft
- create 返回 modified → 明确错误（新建意图只接受 created）
- 已登记结果重放 → 返回既有 Return，不产生重复记录
- Accept 时结构证据不完整 → RUNTIME_LIFECYCLE_CONFLICT，事务回滚

## Tests actually run

- `runtime-create-ingestion.test.ts` 8/8：契约、多文件归组、Review 投影、Accept 生命周期、modified 拒绝、0 文件拒绝、>5 文件拒绝、幂等重放
- `runtime-review-service.test.ts` 7/7：老 revise CAS 路径无回归
- local-core 全套 39 文件 / 187 测试全绿
- 全仓库 typecheck 4/4 全绿；lint 无新增错误（仅存量 warning）

## Known limitations

- RUN-06 Adapter Registry 未做：create/revise 的通用路径仍无输出格式派发（Slice B-3）
- 多 Return 的 Accept 语义：Accept 其中一个即完成 Run，其余 Return 仍 pending（逐项接纳/全部接纳的 UI 语义待 Web 侧定义）
- 浏览器级 create 真实 E2E 待 Slice F

## Rollback

Revert `3effe0e`；无 Schema/数据迁移影响。老 Accept 路径（artifact.currentRevisionId 已存在）不受影响。

## Worktree clean / STOP-GO

- Commit 后工作区干净
- **GO → Slice B-3**：Adapter Registry 去硬编码（RUN-06），随后 Slice C

---

_Codex 2026-08-03，全部结论基于本次实测。_
