# MVP Runtime Slice D Review

日期：2026-07-29  
分支：`codex/mvp-fast-build`  
基线：`bb6103b`

## 1. 任务摘要

Slice D1 与 D2 已连续完成。Fake ResultEnvelope 与真实 WorkBuddy
ResultEnvelope 使用同一个 Local Core Ingestion，安全生成 `FileRecord`、Draft
`ArtifactRevision` 和 `ArtifactReturn(pending_review)`。

本 Slice 没有实现 Accept / Reject / Retry，也没有改变 Artifact Current。

## 2. 变更流程

变更前：

```text
Bridge Provider review
→ RuntimeBinding.providerStatus
→ 无 LCOS Return / Draft
```

变更后：

```text
ResultEnvelopeV0
→ Identity / Provider Status
→ Immutable RuntimeInputPack expected output
→ Project / Runtime / Staging / Output realpath
→ regular Markdown file
→ SHA-256
→ FileRecord + Draft Revision + Pending ArtifactReturn
→ SQLite Restart Recovery
```

Current 生命周期保持：

```text
Current Revision
→ 不变

Run Result
→ Draft Revision
→ Pending Return
→ 等待 Slice E 用户决定
```

## 3. 已完成

- `BridgeResultEnvelopeV0` 合同；
- Bridge `get_task_status` → ResultEnvelope 投影；
- ResultEnvelope immutable evidence；
- Task / Run / RuntimeBinding 身份一致性；
- `review / failed / cancelled / timeout` Provider 状态边界；
- `changedFiles` 只允许一个 `created` Markdown；
- output 必须等于 RuntimeInputPack 的唯一 expected output；
- Project → Runtime → Staging → Output 四级 realpath 包含校验；
- staging junction 逃逸拒绝；
- regular file / extension / SHA-256 校验；
- FileRecord、Draft Revision、ArtifactReturn 单事务；
- `runId + canonicalPath + contentHash + action` 幂等重放；
- Current 与 Run Base 不一致时返回可重算 `baseStale=true`；
- cancelled Run 的迟到结果归档 Evidence 后返回
  `LATE_RESULT_AFTER_CANCEL`，不创建 Draft；
- Provider failed / timeout / cancelled 不创建可 Review Draft；
- SQLite 重启恢复 Return、Draft 与 Current 关系。

## 4. D2 真实 WorkBuddy 证据

绑定：

```text
project_id: mvp-fast-build
session_id: session_ee2ab2d6
task_id: task_e13e60ba
Feishu wake message: om_x100b69affdbad0a8c43e321c7afe4f6
```

真实状态：

```text
assigned
→ running  2026-07-29T16:36:52+08:00
→ review   2026-07-29T16:37:37+08:00
```

真实输出：

```text
.workbuddy/slice-d2-live/project/.creative-os/runtime/
  run-slice-d2-live-001/
    runtime-input-pack.json
    staging/script-draft-run-slice-d2-live-001.md
    result/result-envelope-v0.json
```

SHA-256：

```text
80fe50b2bab89ac0eaaed7c5b1fed680afe1dee43d8ab8caaa983f7f20d13705
```

LCOS Ingestion：

```text
ArtifactReturn:
return-6f61e88573cc90102a9c22511daf009b492eeb287c382ee7beb1d892fe49f310

status:
pending_review

Draft Revision:
revision-return-6f61e88573cc90102a9c22511daf009b492eeb287c382ee7beb1d892fe49f310

Draft status:
draft

baseStale:
false

Current:
unchanged

Restart Recovery:
PASS
```

`.workbuddy/slice-d2-live/` 是 ignored 的可丢弃 E2E 证据，不进入 Git。

## 5. 发现并修正的合同问题

第一次 Live probe 暴露：

```text
LCOS ProjectId
≠ Bridge Watcher project_id
```

Adapter 原先错误地把 Canonical `run.projectId` 直接作为 Bridge 路由 ID。现已改为构造
Adapter 时必须显式传入 `bridgeProjectId`，禁止静默使用错误路由。

误创建任务：

```text
task_d590014f
```

已发送 cancel reason。原 Bridge 对 `assigned` 使用 cooperative cancel，因此历史记录仍可能
显示 `assigned + cancel_requested_at`；它不属于成功证据，也没有被 WorkBuddy 执行或产生
项目输出。

当前线上原 Bridge 尚未替换成仓库中的 purified Slice B Runtime，因此 D2 使用：

```text
legacy Bridge auditable task
+ explicit ResultEnvelopeV0 file
+ canonical LCOS Ingestion
```

没有擅自覆盖或升级原 Bridge 运行环境。完整 Canonical Adapter Live E2E 仍需在后续集成点
商量 Bridge Runtime 切换方案。

## 6. 修改文件

- `packages/contracts/src/index.ts`
- `apps/local-core/src/runtime-adapter.ts`
- `apps/local-core/src/bridge-mcp-client.ts`
- `apps/local-core/src/runtime-result-ingestion.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/runtime-adapter.test.ts`
- `apps/local-core/tests/runtime-result-ingestion.test.ts`
- `MVP_V1_EXECUTION_README.md`
- `docs/handoffs/MVP_RUNTIME_SLICE_D_REVIEW.md`

没有 Schema Migration，没有新增依赖，没有修改 lockfile，没有 Web UI 变化。

## 7. 测试

```text
npm run check:fast
PASS

Web unit          102 passed
Local Core unit   106 passed
Domain unit         5 passed
Contracts unit      4 passed
Architecture       27 passed
Build              PASS

npm run test:integration
5 passed

git diff --check
PASS
```

已有 Web hooks / unused expression 与 Import Copy regex warning 保持不变，本 Slice没有新增
lint error。

## 8. 风险与未完成

- Generic Mutation / Artifact PUT 仍可绕过 Accept 生命周期；Slice E0 必须先关闭；
- ArtifactReturn 暂未开放用户 Accept / Reject；
- Provider `review` 不等于 LCOS completed；
- 真实 Bridge Task 暂留 `review`，等待 Slice E 决策后再 finalize；
- Canonical Slice B Bridge Runtime 尚未替换当前 Legacy Runtime；
- Base stale 不新增 Schema 字段，而是通过
  `Artifact.currentRevisionId !== ArtifactReturn.baseRevisionId` 持久可重算。

## 9. 回滚

Revert Slice D 提交即可删除 Ingestion 能力。它不会回退 Schema v6，也不会改变已有 Current。
真实 E2E 输出与 SQLite 均位于 ignored `.workbuddy/slice-d2-live/`，可在任务收口后单独清理。

## 10. 下一步

等待批准后进入 Slice E：

```text
E0 Domain Guard
→ E1 Accept CAS
→ E2 Reject
→ E3 Retry New Run
```
