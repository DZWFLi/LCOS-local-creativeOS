# LCOS MVP 1.0 Runtime Closure Review

日期：2026-07-29

分支：`codex/mvp-fast-build`

实现基线：`d374628`

提交状态：未提交，等待 Dz 明确批准

## 1. 任务摘要

本轮完成 v0.7 UI 到既有 Slice A–E 与 AI Bridge 的最后接线，没有重做 Bridge：

```text
v0.7 Command
→ Canonical LCOS Run
→ RuntimeDispatch
→ RuntimeBinding
→ AI Bridge / WorkBuddy
→ changed_files
→ ArtifactReturn.pending_review
→ Draft Revision
→ Accept / Reject / Retry
→ Current / Superseded
→ Browser Refresh / Local Core Restart Recovery
```

## 2. 实际范围

已完成：

- 浏览器创建真实 Canonical Run，Runtime 模式不再使用前端定时器模拟。
- 新增项目 Run 列表、dispatch、recover、sync、finalize HTTP 接口。
- Local Core 启动时接入既有 loopback Bridge MCP Adapter。
- 保存和恢复 RuntimeDispatch、RuntimeBinding、外部 Task / Session 映射。
- WorkBuddy 返回的 `changed_files` 经 Path Guard、Hash 与不可变 ResultEnvelope 校验后创建 Draft。
- Work Rail 显示真实 queued / running / review / completed / failed。
- 接入 Accept、Reject、Retry UI。
- Accept 使用 CAS 推进 Current；Retry 创建新 Canonical Run；Reject 不改变 Current。
- Primary ArtifactView 跟随 Artifact Current；`explicit_additional` View 保持固定 Revision。
- Runtime 临时 Process / Return 节点不进入 Generic Mutation Project Truth。
- 兼容当前旧 V3 Bridge：缺失 `lcos_run_id` 时使用已持久化 Binding；若明确返回错误 Run ID 仍硬拒绝。
- 保留 WorkBuddy 写入的丰富 ResultEnvelope；Bridge 摘要差异不再制造伪冲突。
- 修正确认 UI 中过时的 Codex 执行器文案为 WorkBuddy。
- 修正 Phase 2.5 Golden Path 测试实体的全局短 ID 冲突。

未做：

- 没有重写 Bridge Core。
- 没有引入 Watcher、PPT/DOCX 修改、多 Executor 或真正的 `waiting_input`。
- 没有新增依赖或 Schema Migration。
- 没有修改外部 `E:\Buddy项目\ai-bridge` 源目录。
- 没有 Push 或提交。

## 3. 数据与合同变化

### Canonical Run

新增应用服务负责：

```text
ContextManifestV0 持久化
→ Run + RuntimeDispatch 原子创建
→ Bridge 派发 / 恢复 / 同步
→ Result Ingestion
→ Review 聚合
```

Provider 状态继续只保存在 RuntimeBinding，未污染 Canonical Run 枚举。

### Artifact Return

```text
Bridge review
→ 唯一 declared changed_file
→ staging realpath / junction Guard
→ content hash
→ FileRecord
→ Draft Revision
→ ArtifactReturn.pending_review
```

Accept 前不改变 Artifact Current。

### View 映射

```text
primary
→ 跟随 Artifact.currentRevisionId

explicit_additional
→ 固定到 ArtifactView.revisionId
```

没有改变 Artifact / Revision Domain，只修正 Web Runtime 投影。

## 4. 真实 E2E 证据

Run：

`run-d190abd4-d23a-4872-98c4-bd8a06bb9216`

Bridge：

- Task：`task_bec3f4cb`
- Session：`session_ee2ab2d6`
- Project：`mvp-fast-build`
- Executor：WorkBuddy

真实状态：

```text
created / queued
→ Bridge assigned
→ WorkBuddy running
→ Bridge review
→ Draft Return
→ Browser refresh recovery
→ Accept
→ LCOS completed
→ Bridge completed
```

结果证据：

- RuntimeInputPack：`apps/local-core/.data/mvp-sample-project/.creative-os/runtime/run-d190abd4-d23a-4872-98c4-bd8a06bb9216/runtime-input-pack.json`
- Draft：`apps/local-core/.data/mvp-sample-project/.creative-os/runtime/run-d190abd4-d23a-4872-98c4-bd8a06bb9216/staging/script-draft-run-d190abd4-d23a-4872-98c4-bd8a06bb9216.md`
- ResultEnvelope：`apps/local-core/.data/mvp-sample-project/.creative-os/runtime/run-d190abd4-d23a-4872-98c4-bd8a06bb9216/result/result-envelope-v0.json`
- ArtifactReturn：`return-f5f3b094086b0d0f0f12af2a71ae969bb8b4a2838c9b4490f4928d739e7ddb1c`
- Current Revision：`revision-return-f5f3b094086b0d0f0f12af2a71ae969bb8b4a2838c9b4490f4928d739e7ddb1c`

浏览器验证：

- Draft Return 节点进入待确认区。
- 刷新浏览器后仍恢复待确认 Run 与 Draft。
- Accept 后待确认节点消失。
- 重新选择 Brief 后，Inspector 显示新的 Revision、FileRecord、Hash 与 staging 路径。
- 应用日志未发现 LCOS 前端 error / warning。
- Browser 插件自身的 Statsig 外网超时与 LCOS 无关。

截图调用发生一次 Browser 插件 CDP 超时，因此本报告使用 DOM、HTTP、SQLite 和文件证据，不伪造截图路径。

## 5. 修改文件

### Local Core

- `apps/local-core/src/bridge-mcp-client.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/runtime-adapter.ts`
- `apps/local-core/src/runtime-application-service.ts`
- `apps/local-core/src/runtime-result-ingestion.ts`
- `apps/local-core/src/server.ts`

### Web

- `apps/web/src/App.tsx`
- `apps/web/src/features/create/RunConfirmDialog.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/runtime/v07UiContracts.ts`

### Contracts、测试和文档

- `packages/contracts/src/index.ts`
- `apps/local-core/tests/bridge-mcp-client.test.ts`
- `apps/local-core/tests/runtime-application-service.test.ts`
- `apps/local-core/tests/runtime-http.test.ts`
- `apps/local-core/tests/runtime-result-ingestion.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `apps/web/tests/v06RunConfirmation.test.ts`
- `apps/web/tests/v07Integration.test.ts`
- `scripts/phase25-golden-path.mjs`
- `docs/architecture/ADR_MVP10_RUNTIME_UI_CLOSURE_2026-07-29.md`
- `MVP_V1_EXECUTION_README.md`

## 6. 测试结果

通过：

- `npm run check:fast`
  - Web：27 files / 107 tests
  - Local Core：19 files / 119 tests
  - Domain：1 file / 5 tests
  - Contracts：1 file / 4 tests
  - Architecture：4 files / 27 tests
  - Typecheck：全部通过
  - Production build：通过
- `npm run test:integration`
  - 1 file / 5 tests
- `npm run test:architecture`
  - 4 files / 27 tests
- `npm run test:e2e:golden`
  - Phase 2.5 数据恢复 Golden Path 通过
- `npm run check`
  - 通过
- `git diff --check`
  - 通过
- 真实 Bridge / WorkBuddy / Browser Golden Path
  - 通过

Lint 保留仓库已有 warning，包括历史 Hook dependency、control-regex 和一个
unused-expression warning；没有 lint error。本轮没有为掩盖真实 Diff 大范围清理旧 warning。

## 7. 风险与未完成

- 当前运行中的 Bridge 是旧 V3 合同，Local Core 使用兼容回退；提纯 Bridge 自身仍保留新合同实现。
- 真正 `waiting_input` 未实现，MVP 使用 Review + Retry，不做假暂停/Resume。
- Reject / Retry 的 Domain 与 HTTP 测试已覆盖；本轮真实浏览器链选择 Accept 作为最终 Golden Path，未再额外制造两条真实 WorkBuddy 任务。
- Runtime 只支持 Markdown Script Revision；PPT/DOCX 修改、多 Executor 不在 MVP 1.0。
- Primary View 跟随 Current 的投影已有定向测试；额外引用仍固定 Revision。

## 8. 回滚

本轮尚未提交。回滚时只需放弃本轮工作区变更；不得使用 `git reset --hard` 覆盖未知用户修改。

若提交后回滚，应整体 revert Runtime UI closure 提交；Slice A–E 与 Bridge 提纯基线不需要回滚。

## 9. 结论

按 `MVP_V1_EXECUTION_README.md` 冻结的单项目、单用户、单 Executor、Markdown
纵向切片，本轮已经形成真实 MVP 1.0 Runtime 闭环。

下一步应由 Dz 决定：

1. 提交当前闭环；
2. 继续手工验收；
3. 讨论合并回主开发线与后续新规划。
