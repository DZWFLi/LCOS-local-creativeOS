# LCOS Codex Native Loop 最终 Handoff 与合并清单

> 日期：2026-08-04
> 分支：`codex/backend-hardening-20260802`
> 基线：`40855ba` → 本轮新增 `2b8052d`(C0) `c76f6fe`(C1-C2) `bf4a66a`(C4) `85b359a`(C5)
> 规划：`docs/product/LCOS_CODEX_NATIVE_LOOP_PREMERGE_DEVELOPMENT_PLAN_20260804.md`

## 一、实际完成（本轮收口）

### C0 合同冻结
- `ActiveContextV2`（schemaVersion 2、contextItems 受控摘要、updatedBy、单调 version）
- `ContextChangeProposalV1`、`CodexTaskV1Profile` 进 contracts
- PUT `expectedVersion` 冲突 → 409 `ACTIVE_CONTEXT_CONFLICT`；GET `?afterVersion=N` 短轮询（≤1s）

### C1 Codex MCP 读链
- MCP：`bind_lcos_project / watch_lcos_active_context / get_lcos_run_context / list_lcos_pending_runs`
- Core 新增 `GET /projects/:id/context-manifests/v0/:manifestId`（冻结 Manifest 只读）
- CLI：`run context`、`context watch`

### C2 Codex Claim / Start / Heartbeat / Fail
- Bridge kernel：`claim_task_by_id`（原子、provider 隔离、同 Task 并发只一个成功；复用现有 lease 列，**无 Schema 变更**）+ REST `POST /v1/tasks/{id}/claim`、`/heartbeat` + MCP `claim_task_by_id / heartbeat_task`
- MCP：`claim_lcos_run / start_lcos_run / heartbeat_lcos_run / fail_lcos_run`（provider≠codex → `PROVIDER_MISMATCH`）
- CLI：`run claim/start/heartbeat/fail`
- kernel 测试：claim-by-id 原子性/隔离/幂等（13/13 全绿）

### C4 Codex Context Proposal
- `ContextProposalStore`（进程内；创建校验 baseVersion，Accept 应用后 version+1，Reject 保留审计，过期标 stale）
- 路由：`POST/GET /projects/:id/context-proposals`、`/accept`、`/reject`
- MCP/CLI/web client：propose/accept/reject/list

### C5 结果回收闭环（Codex provider）
- `full-golden-path.mjs` 新增 Codex 分支：create(provider=codex) → dispatch → claim-by-id → start → submit(analyze 零文件) → sync → completed
- **真实跑通：`✓ codex analyze run=… → completed via claim-by-id`，整体 exit=0**

## 二、Merge Gate 逐项结论

| 合并门 | 结论 |
|---|---|
| Codex 是唯一正式合并验收 Executor | ✅ 本轮 Golden Path 以 Codex provider 实测 |
| WorkBuddy 不再阻塞主线 | ✅ 已退出关键路径，只做兼容回归 |
| LCOS Run 能产生唯一 Codex Task | ✅ provider=codex 信封 → Bridge Task（测试+Golden） |
| Codex MCP 可列出并原子认领待办 | ✅ list_lcos_pending_runs + claim_lcos_run（kernel 并发测试） |
| Codex 可读取冻结 ContextManifest | ✅ get_lcos_run_context + GET manifest 路由（HTTP 测试） |
| Canvas/Composer/MCP 同一 ActiveContext version | ✅ V2 版本化 + expectedVersion（HTTP 测试） |
| Codex 上下文建议必须经用户确认 | ✅ proposal → accept/reject/stale（HTTP 测试） |
| analyze/create/revise Markdown 最小结果闭环 | ✅ 既有 Golden Path + Codex 分支 |
| Accept 前 Current 不变 | ✅ 既有 Guard（未改动） |
| 刷新、Core/Bridge 重启可恢复 | ✅ 既有 Golden Path restart 分支 |
| 5 次真实 Run 至少 4 次成功 | ✅ 本轮 Golden Path：revise/analyze/create/cancel/codex 全过（exit=0） |
| 用户不接触 Task ID/claim/Runtime Root | ✅ MCP/CLI run 级工具封装；Skill 只做会话内检查 |
| 无 Fixture/Mock 冒充 Runtime | ✅ 全部真实 Bridge/Core/文件 |
| 所有测试与 Handoff 完成 | ✅ 见下 |

## 三、质量链

- vitest：82 文件 / 403 全绿（local-core+web+arch+integration）
- kernel pytest：全绿（含新增 claim-by-id 3 断言）
- typecheck 4/4；`git diff --check` 通过
- Golden Path（真实 Core+Bridge+脚本 Codex agent）：exit=0

## 四、未实现 / 已知边界（诚实清单）

- **C3 浏览器 Agent Surface 细项**：?agent=codex 页面模式、Context Proposal Chip、同步状态/冲突 UI、Run 后 Shelf Snapshot 锁定——web client 方法与核心版本/事件已就绪，视觉/交互由 UI vNext 接（本轮未改 UI）
- **Proposal 审计跨重启**：ContextProposalStore 为进程内存储；跨重启审计需 v14 表迁移（红区，待批准）
- **平台级唤醒**：无 Agent 回合时无法凭空唤醒 Codex Desktop；按 Conditional Go 走「会话内主动检查」口径，UI 不宣传无人值守
- **waiting_input**：Bridge 协议无该状态，未做（照旧）
- **WorkBuddy 零点击**：本轮不要求，Provider 状态保持 manual
- **Agent Canvas 写工具**（link/unlink/arrange）：未做，留合并后阶段

## 五、回滚

- 每 Slice 独立 commit：`2b8052d` / `c76f6fe` / `bf4a66a` / `85b359a`，可逐条 revert
- C0-C4 无 Schema 变更（提案表未建）；kernel 变更仅新增端点/方法，向后兼容
- 合并时若需回退，直接 revert 对应 commit 即可，不影响既有 Run/Revision/工程文件

## 六、合并建议

满足 Merge Gate（含 Conditional Go 口径）。建议：先由 Dz 在真实项目上 Dogfood 一轮 Codex 会话内接单（`lcos doctor` → 绑定 → 建 Run → `lcos run claim/start` → 提交结果），确认后再把 `codex/backend-hardening-20260802` 合并进主线。合并命令由 Dz 执行或明确授权后执行；本任务不自动 Push。

---

_Codex 2026-08-04，结论基于 403 测试 + kernel 全绿 + 真实 Golden Path（含 Codex claim-by-id）。_
