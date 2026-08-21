# Slice B-1 Handoff：analyze 零文件真实路径 + Web Intent 选择

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commit：`cbc4816`

## Decision

Slice B 第一步完成：analyze 从「被误当 revise、生成 Markdown Draft」改为真实零文件完成路径；Web Run 确认页新增 Intent 选择（修改/分析/新建），并把 Intent 传入 Core。直接对应工作单失败样本 `run-84682e18`（分析 PDF 被建成 revise）。

## Exact files

- `apps/local-core/src/runtime-result-ingestion.ts`：`IngestedRuntimeResult` 改为 `revise | analyze` union；analyze 分支要求零 changed files，更新 Run 为 completed，返回结构化 summary，不创建 Draft
- `apps/local-core/src/runtime-adapter.ts`：analyze 的 Task 合同 expectedOutputs=[]、outputPolicy { allowZeroFiles:true, maxFiles:0 }；不创建 script-draft 路径
- `apps/web/src/runtime/v07UiContracts.ts`：新增 `RunOutputIntent`
- `apps/web/src/runtime/localCoreClient.ts`：`CreateRuntimeRunInput` 增加 outputIntent/requestedProvider，targetArtifactId 可选
- `apps/web/src/features/create/RunConfirmDialog.tsx`：Intent 三段选择 + 按 Intent 调整就绪条件与文案
- `apps/web/src/App.tsx`：runIntent 状态；startRunFrom/confirmRun 按 Intent 放行（analyze/create 无目标也可 Run），createRuntimeRun 传 outputIntent
- 测试：`runtime-analyze-ingestion.test.ts`（新增 3 例）、`runtime-result-ingestion.test.ts`（union 适配）、`july-plan-gap-protection.test.ts`（RUN-01/02 锁定改为正向断言）

## Schema

无迁移（outputIntent 字段已存在于 v7 Schema）。

## Before / After flow

```text
Before: Web 不传 Intent → Core 默认 revise → Adapter 生成 Markdown Draft 合同
        → analyze 的 PDF 分析被当作修改执行
After:  Web 显式选择 analyze → Run.outputIntent=analyze
        → Adapter 零文件输出合同 → Provider 返回 review + 0 changed files
        → Ingestion 标记 Run completed，返回分析摘要，无 Draft
```

## Security impact

- analyze 仍不允许 Provider 返回文件（changedFiles != 0 → CONTRACT_UNSUPPORTED）
- 证据归档/绑定更新路径不变

## Failure recovery

- analyze 带文件 → 明确错误，不落 Draft
- create 暂未开放（保留明确错误，下一小步实现 Return Group）

## Tests actually run

- 定向 36/36（ingestion + analyze 3 例 + protection + web client）
- lint / typecheck 全绿

## Known limitations

- create 多文件 Return Group 未实现（Slice B-2）
- RUN-06 Adapter Registry 仍未做（script-draft 仍用于 revise/create）
- 浏览器级 analyze 真实 E2E 待 Slice F

## Rollback

Revert `cbc4816`；无 Schema/数据迁移影响。

## Worktree clean / STOP-GO

- Commit 后工作区干净
- **GO → Slice B-2**：create 多文件 Return Group + Ingestion 多文件接纳；随后 Adapter Registry

---

_Codex 2026-08-03，全部结论基于本次实测。_
