# LCOS 实时同步同根风险审计与加固 R1（2026-08-15）

## 任务摘要

依据 `LCOS_实时同步同根风险审计_20260815.md` 对当前 B3 Closed / B4 Closed 全栈进行代码审计，并优先修复已实际出现的“本地服务暂不可用 / 保存失败”同根问题。本轮关闭 Presentation 多流竞争、旧响应回滚、Presentation intent 静默丢失、Active Context 跨项目队列与 effect abort、Run 双源竞态；不虚报为完整统一事件总线。

## 实际范围与结论

| 风险 | 本轮状态 | 证据 |
|---|---|---|
| 每 Capability 一条 Presentation SSE | 已修改 | Local Core 项目级订阅 + Web 页内共享连接 |
| SSE 断开后静默终止 | 已修改（Presentation） | 指数退避重连；重连首帧为全量 version snapshot |
| hidden tab 保持 Presentation 流 | 已修改 | `visibilitychange` 隐藏 abort、前台重连 |
| 迟到旧 GET 覆盖新状态 | 已修改 | `applyRemote` 只接受更高 version；新增回归测试 |
| Presentation 保存失败丢 pending | 已修改 | 保留 optimistic intent，提示“结果无法确认”，待快照重基 |
| Active Context cleanup abort 已发写入 | 已修改 | cleanup 仅取消未 dispatch 的 debounce，不 abort 在途 PUT |
| Active Context 全局队列 | 已修改 | 按 `projectId::workspaceId` 分队列、分 version |
| Run SSE + 4 秒 polling 双源 | 已修改 | agentMode 使用 SSE 时禁用 polling；hidden tab 停 polling |
| 全域单一 `/projects/:id/events` | 未完成 | 本轮只合并 Presentation；Active Context 仍为独立旧通道 |
| writer envelope / operationId | 未完成 | 需要 contracts 与所有写入口统一设计 |
| Attention cancel 传播 / 总 deadline | 未完成 | 需独立后端批次，避免局部 timeout 冒充取消 |
| 六态同步 UI | 部分 | 现有 synced/syncing/conflict 保留；尚无独立 recovering/write_uncertain/offline 视觉体系 |

## 变更流程

```text
Before
Context SSE + Workflow SSE + Arrange SSE + Active Context SSE + Run Poll + HMR
  → 同源连接竞争 → PUT 排队 → timeout → intent 丢失/假失败

After R1
Shared Project Presentation SSE + Active Context SSE(Agent only) + HMR
  → Presentation change 按 id 分发 → GET authoritative → monotonic apply
  → hidden pause / foreground reconnect snapshot
Active Context semantic PUT
  → per project/workspace queue → CAS → conflict refresh/replay
  → cleanup 不取消已发出的写
```

## 修改文件

- `apps/local-core/src/presentation-application-service.ts`
- `apps/local-core/src/routes/presentations.ts`
- `apps/local-core/tests/presentation-persistence.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/state/presentationViewState.ts`
- `apps/web/tests/presentationViewState.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `docs/audit/LCOS_REALTIME_SYNC_RISK_CHANGE_PROTOCOL_20260815.md`
- `docs/OPEN_DEBTS.md`
- 本交接文件

## 测试结果

- lint：通过（仅既有 warning，无 error）。
- typecheck：Web、Local Core 通过。
- 定向回归：20/20 通过。
- 全量 unit：Web 452/452；Local Core 408/408；Domain 10/10；Contracts 6/6。
- build：通过；Vite 仅报告既有大 chunk warning。
- smoke：通过，20 built assets，React root present。
- B4 static：19/19。
- B3R6 static：16/16。
- `git diff --check`：通过，仅 Windows LF/CRLF 提示。

## 真实浏览器证据与阻塞

未完成真实浏览器验收。执行官方 `npm run dev:stop` 后，`npm run dev:open` 因当前工作树含本轮未提交改动而按安全规则拒绝启动。当前未获得本轮 commit 授权，因此没有绕过 launcher、没有自行提交，也没有用旧进程冒充新代码验收。开发栈目前处于停止状态。

## 风险与未完成

1. 这不是最终统一 Project Event Bus；Agent mode 仍可能同时持有 Presentation 与 Active Context 两条业务 SSE。
2. Presentation 保存超时会保留 intent，但尚未提供独立 `write_uncertain` badge；当前依靠明确 notice 和后续 snapshot/rebase。
3. Active Context payload 仍包含 viewport/visible ids；虽然 debounce 和不再 abort 已降低风险，ephemeral viewport 与 semantic intent 的接口级拆分仍未完成。
4. 缺少 2–3 标签页、断网/恢复、乱序响应注入的真实浏览器压力证据。

## 下一步

获得本轮 commit 授权后：提交当前可审查批次 → 官方 launcher 启动 → 2–3 标签页连续拖动/改名/切 Capability/保存 → 检查 Network 每页业务 SSE 数量和 PUT latency → 隐藏/恢复标签页 → 断开/恢复 Local Core → 保存截图与日志。若通过，再进入统一 `/projects/:id/events` 与六态同步 UI 的 R2。

## 回滚

本轮无 Schema 迁移。逐文件 revert 本交接列出的代码即可恢复旧消费方式；不得使用 `reset --hard`。旧 Presentation 单视图 SSE 端点仍保留，回滚无需数据变换。
