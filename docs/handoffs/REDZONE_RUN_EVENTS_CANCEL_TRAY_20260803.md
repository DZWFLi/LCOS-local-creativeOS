# 红区 Handoff：RunEvent 持久化 + Run Cancel + 托盘宿主 v1

> 日期：2026-08-03
> 分支：`codex/redzone-20260803`（独立 worktree：`E:\Codex 项目\OS开发\.worktrees\redzone-runtime-events`）
> 范围：Schema 变更（run_events 表 v10）、cancel 后端链路、托盘宿主实现（原红区项，Dz 指示单独开树继续做）

## Decision

红区三项在独立 worktree 完成并实测：

1. **RunEvent 持久化（RUN-10）**：新增 `run_events` 表（Schema v9 → v10，纯新增迁移），按 run 分配自增 sequence；create/dispatch/sync/accept/reject/retry/cancel 生命周期自动发射事件；HTTP `GET /runs/:id/events` + CLI `lcos run events` + MCP 读取能力。
2. **Run Cancel（CLI-06）**：Bridge MCP `cancel_task` 接通 McpBridgeRuntimeClient → `RuntimeAdapterService.cancel`（终态拒绝、无绑定明确报错）→ 应用层 cancel → HTTP `POST /runs/:id/cancel` → CLI `run cancel` / MCP `cancel_lcos_run`；取消后 run 状态 cancelled + `run.cancelled` 事件。
3. **托盘宿主 v1（RT-04）**：按 ADR 方案 A 实现 `scripts/runtime-host-tray.ps1`（PowerShell + .NET NotifyIcon，零新依赖）：打开 GUI / 状态快照（写入日志+剪贴板）/ 重启 Core+Bridge / 完全退出；`npm run tray` 入口；ADR 状态更新为已批准并实现。

## Exact files

- `apps/local-core/src/metadata-repository.ts`：`#migrate_010_from_v9`（run_events 表 + 索引 + user_version=10）、`createRunEvent`（幂等重放 + 按 run 自增 sequence）、`getRunEvents(runId, afterSequence?)`；legacy 迁移链保持原语义（1–6 仍止于 v8，0/7/8/9 追加 v10）
- `apps/local-core/src/runtime-application-service.ts`：`emit()` 助手 + create→`run.queued`、providerAction→`started/review_ready/completed/cancelled/failed`、`cancel()` 应用方法
- `apps/local-core/src/runtime-review-service.ts`：accept/reject→`run.completed`、retry→`run.retry_queued`
- `apps/local-core/src/runtime-adapter.ts`：`BridgeRuntimePort.cancelTask?`、`cancel()`（终态优先拒绝、真实 Bridge 取消、binding/run 状态更新）
- `apps/local-core/src/bridge-mcp-client.ts`：`cancelTask` → bridge `cancel_task`
- `apps/local-core/src/server.ts`：`GET /runs/:id/events`（after 校验）+ `POST /runs/:id/cancel`
- `tools/lcos-agent/cli.mjs` + `mcp-server.mjs`：`run events` / `run cancel` / `cancel_lcos_run`
- `scripts/runtime-host-tray.ps1` + `package.json`（`npm run tray`）
- 测试：metadata run_events 持久化/sequence/重放；application events/cancel/终态拒绝；HTTP events+cancel 全链；schemaVersion 断言 9→10
- `docs/architecture/ADR_RUNTIME_HOST_TRAY_20260803.md`：状态 → 已批准并实现 v1

## Schema

`PRAGMA user_version` 9 → 10；新表 `run_events(id, run_id, sequence, type, payload_json, occurred_at, UNIQUE(run_id, sequence))`；纯新增、无破坏；legacy v1–v6 迁移路径保持原终点（v8）。

## Golden Path 实测（红区树，真实 Core+Bridge+Agent）

```text
✓ revise：事件链 run.queued → run.started → run.review_ready → run.completed 逐项断言通过
✓ cancel：bound Run 真实 Bridge 取消 → run.cancelled 事件存在
✓ analyze / create / checkpoint / Core 重启恢复：原链无回归，exit=0
```

## Security impact

- 事件 payload 只写结构化 JsonValue（runId/projectId/returnId），不含敏感内容
- cancel 仅限非终态 Run；终态返回 `RUN_ALREADY_TERMINAL`
- 托盘只调用既有 npm 脚本，不新增权限面

## Known limitations

- 托盘 UX（右键菜单交互）需人工确认；脚本仅语法验证 + 设计评审
- GUI Activity 面板未接事件流（RunEvent API 已就绪，UI 消费待前端同步）
- Watcher / Safe Write 仍属未批准红区，未在本树施工

## Rollback

Revert 本分支提交即可；Schema v10 为纯新增，旧版本代码打开 v10 库会走 v9 分支缺表——因此合并主线时需同步迁移链（已在链中）。

---

_Codex 2026-08-03，红区树实测结论。_
