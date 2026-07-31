# MVP Runtime Slice A Review

日期：2026-07-29
分支：`codex/mvp-fast-build`

## 1. 决策与实际范围

Slice A 已完成 Canonical Contracts、SQLite Migration v6、最小 Runtime Repository，以及 Migration / Architecture Tests。

本 Slice 没有实现 BridgeAdapter、`create_task`、状态同步、Watcher、WorkBuddy 唤醒、Result Ingestion、Draft Revision、Accept / Reject / Retry、HTTP API 或前端接线。

## 2. 变更前后流程

变更前：

```text
Context 仅在请求时生成
→ 无 canonical Run 持久化
→ Provider Task 状态可能与产品状态混用
```

变更后：

```text
Project Truth
→ 生成并持久化不可变 ContextManifestV0
→ 原子创建 Canonical Run + RuntimeDispatch
→ RuntimeBinding 单独保存 Provider 身份与状态
→ ArtifactReturn 单独保存待审核返回记录
```

## 3. Canonical Contract

- Canonical Run 状态仅为：
  `created / queued / running / waiting_input / completed / failed / cancelled`
- RuntimeDispatch 状态仅为：
  `planned / dispatching / bound / failed / recovery_required`
- ArtifactReturn 状态仅为：
  `pending_review / adopted / rejected`
- Provider Task 状态只进入 `RuntimeBinding.providerStatus`，不进入 `runs`。
- `retryOfRunId` 使用 `runs.id` 自引用外键。
- ArtifactRevision 继续复用既有 `runId`、`parentRevisionId`、`status`，未重写 Revision Domain。

## 4. Migration v6

新增五张独立表：

1. `context_manifests`
2. `runs`
3. `runtime_dispatches`
4. `runtime_bindings`
5. `artifact_returns`

幂等唯一键：

- `runtime_dispatches.idempotency_key`
- `runtime_bindings(provider, external_task_id)`
- `artifact_returns(run_id, canonical_path, content_hash, action)`

v5 → v6 升级先生成 `.v5.bak`，保留既有 Project 数据，再创建 Runtime 表。

## 5. ContextManifestV0

- 持久化到 SQLite；
- 使用 canonical JSON 的 SHA-256 形成稳定 ID 与 `manifestHash`；
- 同一 canonical 内容重复创建时返回同一记录；
- 已持久化内容不可更新；
- 禁止 canonical JSON 包含绝对路径及以下运行时字段：
  `provider`、`bridgeTaskId`、`externalTaskId`、`externalSessionId`、
  `runtimeRoot`、`stagingPath`、`mcpUrl`。

## 6. Repository 边界

新增的最小 Repository 只提供：

- ContextManifest 创建与查询；
- Run + RuntimeDispatch 原子创建与查询；
- RuntimeBinding 创建与查询；
- ArtifactReturn 创建与查询。

新 Runtime Repository 没有调用 Generic Mutation 或 Artifact PUT，也没有修改 `currentRevisionId`。

## 7. 测试结果

专项 Runtime 测试：

- Fresh DB v6：PASS
- v5 → v6 Upgrade：PASS
- Restart Recovery：PASS
- FK Enforcement：PASS
- Unique Constraints：PASS
- ContextManifest Immutability：PASS
- Run Status Enum：PASS
- Provider Status Separation：PASS
- `retryOfRunId` Self Reference：PASS

完整质量链：

- `npm run check:fast`：PASS
- `npm run test:integration`：5/5 PASS
- `npm run test:architecture`：27/27 PASS
- `npm run check`：PASS
- `git diff --check`：PASS

已知非阻塞输出：

- `apps/web/src/App.tsx` 既有 7 条 lint warning；
- `apps/local-core/src/import-copy-service.ts` 既有 1 条 lint warning；
- Node `node:sqlite` ExperimentalWarning。

## 8. 风险与未完成

P0 已登记：Generic Mutation / Artifact PUT 当前可直接修改 `currentRevisionId`，存在绕过 Accept 生命周期的风险。本 Slice 按批准范围没有扩大修改；最迟应在 Accept Slice 开工前增加正式 Domain Guard。

当前五表与 Repository 只是持久化地基，尚未接入真实 Provider，不应对外宣称 Bridge 执行闭环已成立。

## 9. 回滚

代码回滚可 revert Slice A 实现提交。数据库升级前会留下 `.v5.bak`；如需恢复，应先停止 Local Core，保留当前 v6 数据库副本，再由人工用备份替换，不能在运行中覆盖。

## 10. 下一步

本 Slice 到此停止。后续 Adapter、派单和状态同步必须等待下一次明确批准。
