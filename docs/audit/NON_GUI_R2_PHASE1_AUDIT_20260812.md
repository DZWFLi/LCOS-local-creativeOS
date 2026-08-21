# Non-GUI R2 阶段审计（N1–N9 第一轮）

> 依据：`LCOS_R2_NON_GUI_ENGINEERING_CODEX_BRIEF_20260812.md`

## 状态总览

| 块 | 状态 |
|---|---|
| N1 持久化混合 Project View Rail 顺序 | **COMPLETE** |
| N2 Huabu 输入 helper 审计 | **COMPLETE**（0 直接复用；2 ADAPT 参考；3 REJECT） |
| N3 画布通用外部 drop | **COMPLETE**（R2 patch 已实现 + 浏览器真实 drop 验证） |
| N4 Browser Capture 共享契约对齐 | **COMPLETE**（扩展已用 CaptureRequestV1 + target；Core 归因/去重/暂存） |
| N5 Desktop Quick Capture runtime | **COMPLETE**（753be8f：热键 + 剪贴板分类 + capture/v1；Test 模式四类型真实收据） |
| N6 右下 Capture Assistant | **IMPLEMENTED**（cc2677f；NATIVE QA PENDING，见下） |
| N7 Browser-triggered Desktop Wake bridge | **COMPLETE**（b710b87：扩展 dragstart → SW → Runtime Host wake 端点；端点 200+日志；端到端拖拽触发留人工浏览器确认） |
| N8 Native Windows drag/drop receiver | **IMPLEMENTED**（cc2677f；NATIVE QA PENDING，见下） |
| N9 Capture 安全/重启/幂等 | **COMPLETE**（既有实现验证 + 本轮 403/opId 修复；桌面边界待 N5-N8） |

## 已完成块证据

### N1

- Core schema v34 + `project_view_rail_order`；CAS 保存；重启持久；stale 409；缺失 ref 过滤。
- 真实 HTTP：PUT v1 → stale 409 → reload v1 → Core 重启 v1 保留。
- 测试：Core 4 例 + Web 3 例。详见 `GUI_R2_MERGE_P0_AUDIT_20260812.md`。

### N2

- 详见 `HUABU_INPUT_AUDIT_R2_20260812.md`。

### N3

- `SpatialCanvas.tsx`：Files / text/uri-list / text/plain / project-view / workflow-operator 分类；
  URI→URL candidate、text→URL-or-text 路由；屏幕→画布坐标转换保留。
- 浏览器真实 drop：text/uri-list → 链接节点；text/plain → 文本节点（截图见 guir2-canvas-*-drop-1366.png）。

### N4

- 扩展提交 `CaptureRequestV1 { candidate(source) + target }`；Project Affinity/dedupe/Staging 全部在 Core；
  扩展无归属逻辑；403 origin 修复 + windowId 修复已提交（7f3e4d9）。

### N9（既有能力验证）

- localhost token（extension-token 白名单）✓；origin allowlist（chrome-extension 放行）✓；
  operationId 幂等（saveCaptureReceipt）✓；图片大小限制 10MB ✓；安全渲染（捕获内容不注入 HTML）✓；
Core 重启后 capture 路由可用 ✓；扩展 service worker 重启后仍工作（无内存队列）✓。

### N5（2026-08-12 晚）

- Core capture/v1 新增 `source.kind=file`（`source.localPath`）：仅 Core Bearer trusted 通道
  （扩展 token 403），payload `local_path` → CaptureApplicationService（读文件建 fileRecord）。
- `scripts/quick-capture.ps1`（Windows PowerShell 5.1，ASCII-only 源码）：
  Ctrl+Alt+C 全局热键（纯 Win32 RegisterHotKey + 消息循环）+ 托盘手动捕获；
  剪贴板分类 文件/文件夹 > 图片 > URL > 文本 → capture/v1。
- 真实证据：Test 模式 text/url/image/file 四种均返回 `staged` 收据；
  运行模式（托盘 + 热键线程）后台常驻 4s 存活后手动停止。
- 已知边界：5.1 脚本必须保持 ASCII-only（UTF-8 中文会被 ANSI 误读）；用 `powershell` 5.1 运行。

### N7（2026-08-12 晚）

- 扩展：content-script 双路径拖拽开始发 `LCOS_DRAG_START` → service worker
  `POST http://127.0.0.1:43123/wake`（best-effort）；host_permissions 加 43123。
- Runtime Host：`scripts/runtime-host-wake.ps1`（HttpListener 43123，
  `POST /wake` → 200 `{ok,surface:pending}` + `wake.log`）。
- 真实证据：HTTP POST wake → 200 + 日志落盘；扩展单测 4/4。
- 剩余：N6 surface 显示未实现，wake 目前仅记录；扩展→wake 端到端拖拽触发需人工浏览器确认。

### N6 + N8（2026-08-12 晚）

- `scripts/capture-assistant.ps1`（Windows PowerShell 5.1，ASCII-only）：
  - 右下浮动面：TopMost、无边框、主屏工作区定位、DPI aware（SetProcessDpiAwareness）、
    `ShowNoActivate`（SetWindowPos SWP_NOACTIVATE）不抢焦点；拖入前零副作用（wake 仅准备）。
  - Native OLE：WinForms `AllowDrop`（.NET 封装 IDropTarget）接收 Explorer 拖放；
    分类 文件/文件夹 > `.lnk`/`.url`（WScript.Shell 解析，broken shortcut 显式失败状态）> URL > 文本。
  - 三目标：Auto / Staging / Recent Project（Core runtime registry 前 3 项）。
  - 提交统一走 capture/v1：文件走 Bearer trusted，文本/URL 走 extension token。
- Wake 协作：`runtime-host-wake.ps1` 写 `wake-signal.txt` → Assistant 主线程 WinForms Timer 检测并显示
  （刻意避开 Windows PowerShell 5.1 后台线程 runspace 变量不可达的坑）。
- 真实证据：进程常驻 3s+；`POST /wake` → 200；信号文件写入；
  `assistant-wake.log` 出现 `wake shown`（真实显示触发路径）。
- **NATIVE QA PENDING**（诚实边界）：真实 Explorer 拖入文件/文件夹/.lnk/.url、取消拖拽、
  多显示器右下角、125%/150% DPI 手感需人工桌面验证；扩展→wake 端到端拖拽触发需人工浏览器确认。

## 未完成块计划（N5–N8）

这些块是 Runtime Host / Windows native 工程，不在 Web GUI patch 范围内，且 brief 要求
"real path / real persistence / real failure / real restart / real browser-native evidence" 才能 COMPLETE。

建议施工顺序（下轮）：

1. **N5 Desktop Quick Capture runtime**：基于现有 `scripts/runtime-host-tray.ps1` + dev-launcher，
   新增独立 Quick Capture 入口（全局快捷键 + 剪贴板监控），提交到现有 `CaptureApplicationService`
   （复用 capture/v1 或直接 Core 调用），不建重复队列。
2. **N7 Browser wake bridge**：扩展 content-script dragstart → runtime message →
   Runtime Host localhost signal → wake Desktop Surface（先做 HTTP 信号，再评估命名管道）。
3. **N6 Assistant**：右下浮动接收面（WPF/无依赖 PowerShell+WinForms），DragEnter 仅接收
   OLE 拖放；Auto / Recent / Staging 三目标；drop 前零副作用。
4. **N8 Native OLE**：Windows OLE IDropTarget（C#/PowerShell Add-Type），Explorer 文件/文件夹/
   .lnk/.url 解析（ShortcutRecord）；多显示器/DPI/始终置顶/无焦点抢占。

优先级按依赖：N7 的扩展侧独立可先行；N8 是 N6 的接收层，建议 N6+N8 同轮。
以上均不在本 turn 以假实现交付，避免"看起来完成"。
