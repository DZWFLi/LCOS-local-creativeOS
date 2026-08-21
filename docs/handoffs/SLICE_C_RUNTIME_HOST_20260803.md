# Slice C Handoff：Runtime Host 与 Bridge 常驻

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commits：`7a9a59e`（Launcher 三服务托管）、`1bd23e9`（可靠停止/关 GUI 语义）、`06db974`（端口签名清扫）、`bb9aa27`（双遍清扫）、`1aeb634`（stop 先杀 launcher 防复活）

## Decision

Slice C 完成（除红区托盘）：Launcher 现在同时管理 Core（43121）、Bridge（43122）、Web（5173）；关闭 GUI 只停 Web，Core/Bridge 后台常驻；全部子进程隐藏启动并写文件日志；带健康检查、限次退避重启与崩溃循环保护；`dev:stop` 可靠释放全部端口。托盘宿主按工作单要求先交 ADR（`ADR_RUNTIME_HOST_TRAY_20260803.md`），实现属红区，等批准后单独施工。

## Exact files

- `scripts/dev-launcher.mjs`：
  - `spawnBridge()`：venv python 检测、`LCOS_BRIDGE_RUNTIME_ROOT`、隐藏启动 + 文件日志
  - `open`：bridge/core/web 三服务启动 + 三健康点等待 + Supervisor（崩溃退出 → 限次退避重启；5 分钟窗口 >3 次即停）；5s 健康轮询，连续 3 次失败杀进程重启；浏览器窗口退出 → 只停 Web，Core/Bridge 保持
  - `stopOwned`：先杀端口监听（端口作用域 + lcos_bridge/vite/dist/index.js 签名）、再杀 state 记录 PID（含 launcherPid）、1.2s 后第二遍清扫，防止 npm/cmd 包装进程断链后的孤儿孙进程与 supervisor 复活
  - `status`：增加 Bridge 端口、三服务重启计数、日志目录
- `scripts/dev-stack.mjs`：前台 dev 栈补齐 Bridge（RT-01 双入口一致）
- `docs/architecture/ADR_RUNTIME_HOST_TRAY_20260803.md`：托盘宿主选型（推荐 PowerShell + .NET NotifyIcon，零新依赖），状态=待批准
- `docs/audit/LCOS_CAPABILITY_LEDGER.md`：RUN-01/02/03/04/06/07/08 与 RT-01/02/03/05 更新为实测状态

## Schema

无迁移，无新依赖。

## Before / After flow

```text
Before: open 只起 Core+Web；关浏览器窗口 = 全部停止；Bridge 需单独 npm run bridge；
        npm/cmd 包装进程断链后 dev:stop 杀不干净，端口残留
After:  open 起 Core+Bridge+Web（三健康点确认）
        → 关 GUI 仅停 Web，Core/Bridge 常驻
        → 任一服务崩溃：退避重启（0.5s/2s/4s…），5 分钟超 3 次整体停止
        → dev:stop 杀 launcher + 全部服务 + 端口签名双遍清扫，无残留
```

## Security impact

- 全部子进程 `windowsHide: true`，日志写入 `.codex-runtime/logs/`
- Bridge 仅绑定 `127.0.0.1:43122`，runtime root 在 `.codex-runtime/bridge`
- 端口清扫仅作用于 LCOS 三个端口且校验服务签名，不碰外部进程

## Failure recovery

- 服务崩溃/健康失败 → 限次自动重启（实测 Core 被杀后 2s 内恢复，restarts=1）
- 崩溃循环（5 分钟 >3 次）→ 停止整个 Host 并报错退出
- GUI 意外关闭 → Web 停止，Core/Bridge 继续，可重新 `dev:open`
- `dev:stop` 后端口全空（实测无残留）；若残留，签名清扫双遍兜底

## Tests actually run（真实环境，非 Mock）

1. `npm run dev:open` 隐藏启动 → 43122/43121/5173 全部 200
2. 杀浏览器窗口（模拟关 GUI）→ 8s 后 Web 下线、Core/Bridge 在线，重启计数保持 0（无多余拉起）
3. 杀 Core 进程 → 自动重启，`dev:status` 显示 coreRestarts=1
4. `npm run dev:stop` → launcher 与全部服务退出，三端口全空（多轮实测收敛，含修复前的残留复现与修复）

## Known limitations

- RT-04 托盘宿主：ADR 已交付，实现等 Dz 批准（红区）
- RT-07 Capabilities Handshake：Launcher 启动健康检查已做，Adapter 派发前的能力/版本握手仍未接入
- RT-06 Legacy 写路径盘点未做；RT-10 真实 Run 重启恢复待 Slice F
- 浏览器 E2E（三 Intent 真实链）待 Slice F

## Rollback

Revert `7a9a59e`（及后续 fix）；`dev:stack` 一行恢复原状。无 Schema/数据影响。

## Worktree clean / STOP-GO

- 本 Handoff 提交后工作区干净
- **GO → Slice D**：ActiveContext Web 写回 + CLI/MCP 对齐

---

_Codex 2026-08-03，全部结论基于本次实测。_
