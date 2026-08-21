# ADR：Runtime Host 托盘宿主技术选型（RT-04）

> 日期：2026-08-03
> 状态：**已批准并实现 v1（Approved & Implemented 2026-08-03）** — `scripts/runtime-host-tray.ps1`
> 关联工作单：Slice C（RT-04 托盘可唤起、看状态、诊断、重启、完全退出）

## Context

Slice C 已完成 Node Runtime Host（Launcher 常驻管理 Core/Bridge/Web、无 CMD 窗口、健康检查、限次恢复、日志诊断）。还缺一个用户可见的常驻入口：关闭 GUI 后 Core/Bridge 仍在后台运行，用户需要一个托盘图标来「打开 GUI / 看状态 / 诊断 / 重启 / 完全退出」。

硬约束：

- 不引入 Electron / Tauri；
- 不新增重量级依赖而不先获批（工作单红区：桌面托盘宿主须单独提案和批准）；
- Windows 优先（当前开发机为 Windows）；
- Runtime Host 本体保持 Node 常驻进程，托盘只做「用户入口」，不接管服务生命周期细节。

## 候选方案

### A. PowerShell + .NET WinForms NotifyIcon（推荐）

用 Windows 自带 .NET Framework 的 `System.Windows.Forms.NotifyIcon`，通过 PowerShell（或一行 C# 编译的 helper.exe）实现托盘。

- 依赖：零新增（Windows 10/11 自带）；
- 实现面：单文件 PS1 + 少量 C# glue；托盘菜单 = 打开 GUI / 状态 / 重启 Core+Bridge / 完全退出；
- 通信：托盘只调用现有 `npm run dev:open / dev:status / dev:stop`，不复制生命周期逻辑；
- 风险：PowerShell 宿主启动有 ~100ms 开销；WinForms 在 PowerShell 下需要 `[System.Windows.Forms.Application]::Run()` 保持消息循环；不同 Windows 版本差异小。

### B. Rust tray-icon 小二进制

`tray-icon` crate 编译独立 exe（约 1–3MB），生命周期稳定、无 PowerShell 依赖。

- 依赖：Rust 工具链 + crate（新依赖）；
- 构建成本：首次较高，后续 CI 可缓存；跨平台潜力好；
- 风险：引入新工具链，超出「不新增依赖而不先获批」的红区。

### C. Node 原生托盘模块

`node-tray` 等原生模块需要 Node ABI 匹配编译。

- 风险：ABI 升级脆弱、维护源少，不推荐。

### D. Windows Service + 无托盘

后台常驻最稳，但没有用户可见入口，打开/诊断/退出都靠命令行。

- 适合未来「正式服务化」，不适合当前 MVP 的「托盘可唤起」验收。

## Decision（待批准）

推荐 **方案 A**：PowerShell + .NET WinForms NotifyIcon 托盘，零新依赖，只做用户入口。

批准后实施范围（单独提交）：

1. `scripts/runtime-host-tray.ps1`：NotifyIcon + 菜单（打开 GUI / 状态快照 / 重启 Core+Bridge / 完全退出）；
2. 托盘启动器由 Runtime Host 在 `open` 时可选拉起（`--with-tray`），不改变现有 headless 行为；
3. 重启菜单 = `dev:stop` + `dev:open`（由 Host 幂等处理端口）；
4. 诊断菜单 = 复制 `dev:status` 输出到日志 + 剪贴板。

## 影响与回滚

- 影响模块：`scripts/`（新增托盘脚本 + launcher 可选拉起），无 Schema、无 Core 改动；
- 回滚：删除托盘脚本、从 launcher 移除拉起参数即可，Runtime Host 本身不受影响；
- 若不批准：Slice C 验收中 RT-04 保持「待决策」，其余 RT-01/02/03/05 照常验收。

---

_Codex 2026-08-03。决策稿先行，红区实现等批准。_
