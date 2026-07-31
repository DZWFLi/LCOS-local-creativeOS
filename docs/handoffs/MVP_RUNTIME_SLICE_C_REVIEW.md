# MVP Runtime Slice C Review

日期：2026-07-29  
分支：`codex/mvp-fast-build`  
基线：`f0658d5`

## 1. 任务摘要

Slice C 已完成 Local Core Adapter / Dispatch / Recovery，不包含 Result
Ingestion、ArtifactReturn、Draft Revision、Accept / Reject / Retry、Watcher 或前端接线。

## 2. 实际范围

已完成：

- 从已持久化的 `ContextManifestV0` 和 Canonical Run 物化
  `RuntimeInputPackV0`；
- Pack 固定写入 Project 自有
  `.creative-os/runtime/<runId>/runtime-input-pack.json`；
- Pack 使用 create-only 写入；同路径同内容可重放，不同内容拒绝覆盖；
- Expected Output 限制在当前 Run 的 `staging`；
- 生成与 Bridge Slice B 一致的 `bridge-task-v0` 和请求指纹；
- 通过 loopback MCP 调用 `create_task`；
- 不确定 create 结果进入 `RuntimeDispatch.recovery_required`；
- Recovery 先调用只读 `get_task_by_lcos_run_id`，未找到才幂等 create；
- 持久化 `RuntimeBinding`，并更新 Dispatch 为 `bound`；
- 显式 `sync()` 更新 `providerStatus / lastSyncedAt`；
- Provider `created / queued / assigned / running / failed / cancelled`
  只映射到允许的 Canonical Run 状态；
- Provider `review / timeout` 保留在 Binding，不写入 Canonical Run。

未完成：

- 没有启动真实 Bridge 做 Local Core → MCP Live E2E；
- 没有读取 ResultEnvelope；
- 没有生成 ArtifactReturn 或 Draft Revision；
- 没有 HTTP API、后台 Reconciler、SSE 或前端状态 UI。

## 3. 变更流程

变更前：

```text
ContextManifest + Run + RuntimeDispatch
→ 无 Local Core Adapter
→ Bridge Slice B 与 LCOS 未接线
```

变更后：

```text
ContextManifest + Run
→ Immutable RuntimeInputPack
→ RuntimeDispatch dispatching
→ Bridge create_task
→ RuntimeBinding
→ RuntimeDispatch bound
→ 显式 sync Provider status
```

不确定响应恢复：

```text
create_task 超时 / 断线 / 损坏响应
→ recovery_required
→ get_task_by_lcos_run_id
  → found：绑定原 Task
  → not found：幂等 create_task
```

## 4. 修改文件

- `packages/contracts/src/index.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/runtime-adapter.ts`
- `apps/local-core/src/bridge-mcp-client.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/runtime-adapter.test.ts`
- `MVP_V1_EXECUTION_README.md`
- `docs/handoffs/MVP_RUNTIME_SLICE_C_REVIEW.md`

没有修改 Schema，没有新增依赖，没有修改 lockfile。

## 5. 测试结果

```text
npm run check:fast
PASS

Web unit                102 passed
Local Core unit          97 passed
Domain unit               5 passed
Contracts unit            4 passed
Architecture             27 passed
Build                    PASS

npm run test:integration
5 passed

git diff --check
PASS

追加冻结指纹 Fixture 后：

npm run test --workspace @local-creative-os/local-core -- --run tests/runtime-adapter.test.ts
98 passed（Vitest workspace 配置执行全部 Local Core tests）

npm run typecheck --workspace @local-creative-os/local-core
PASS
```

已有 lint warning 仍存在：

- Web React hooks / unused expression；
- Import Copy control regex。

本 Slice 没有新增 lint error。

## 6. 新增验证

- 同一 Run 重复 dispatch 不创建第二个 Bridge Task；
- Input Pack 实际写入且包含 ContextManifest；
- create 不确定失败进入 `recovery_required`；
- Recovery lookup 找到 Task 后不再次 create；
- 被篡改的 Input Pack 不会被静默覆盖；
- Provider `review` 写入 Binding，但 Canonical Run 保持 `running`；
- 无 Binding 的 sync 返回结构化 `TASK_NOT_FOUND`。

## 7. 风险

- MCP Transport 客户端已实现 loopback、initialize、session header、JSON / SSE
  解析，但尚未对真实运行中的 Bridge 做 Live E2E；
- 当前状态同步由显式调用触发，尚无后台 Reconciler；
- `review` 只是 Provider 证据，直到 Slice D / E 完成前不能宣传完整回收闭环；
- Result output 目前只是受限 staging 路径，不是 LCOS Artifact Truth。

## 8. 回滚

回滚本 Slice 提交即可移除 Adapter 与 Repository 更新方法。Schema v6 和 Slice A / B /
B.5 数据不需要回滚，现有 Project Truth 不受影响。Project 中已物化的
`.creative-os/runtime/<runId>/` 是未进入 Project Truth 的执行材料，可在确认无运行任务后
单独清理。

## 9. 下一步

等待 Dz 批准后进入 Slice D1：

```text
Fake ResultEnvelope
→ changed_files 路径 / hash / action 校验
→ ArtifactReturn pending_review
→ Draft Revision
```

本次停止在 Result Ingestion 之前。
