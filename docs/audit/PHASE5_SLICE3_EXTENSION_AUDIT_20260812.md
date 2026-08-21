# Phase 5 Slice 3 — MV3 LCOS Capture 扩展 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §8.1–§8.8。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / BROWSER ACCEPTANCE PENDING）
Phase 5 整体：**NOT COMPLETE**（剩余：§8.9 桌面快速捕获）

## Acceptance Evidence

### §8.1 MV3 扩展结构
Code: `extension/`（manifest.json + service-worker.js + content-script.js + popup/ + shared/）。
实现用 JS（UMD 共享模块），与方案 TS 命名差异仅为工程形式，行为一致。
Result: DONE

### §8.2 CaptureRequestV1 契约
Code: `extension/shared/capture-message.js` — 六种 source kind
（page/selection/image/link/screenshot/text）、schemaVersion 1、operationId/capturedAt、
target auto|project|staging。
Tests: 4/4（六 kind 冻结、构建校验、非法输入拒绝、网关提交）。
Result: DONE

### §8.3 Popup 流程
Code: `extension/popup/` — 页面/选区/截图三种 kind、auto/staging 目标、状态反馈。
方案中的"最近项目 chips"未实现（项目亲和由 Core 决定，扩展不做归属判断；chips 留后续）。
Result: DONE（chips 除外，见 Remaining Debt）

### §8.4 Service worker 消息处理
Code: `service-worker.js` — `LCOS_CAPTURE_SUBMIT` 先 `validateCaptureRequest` 再提交；
`LCOS_CAPTURE_TAB` 供 popup/content-script 转发，截图走 `captureVisibleTab`。
不信任页面 HTML/任意输入，异常结构化返回。
Result: DONE

### §8.5 Localhost gateway
Code: `extension/shared/localhost-client.js` — 先 `POST /runtime/extension-token` 取扩展 token，
再带 `x-lcos-token` 提交 `http://127.0.0.1:43121/capture/v1`。
Core: `/runtime/extension-token` 移入鉴权白名单区（仅本机回环，免 core Bearer）。
Live HTTP: 无 Bearer `POST /runtime/extension-token` → 200；随后 `POST /capture/v1` →
`{ receipt: { status: "staged" }, destinationLabel: "暂存区" }`。
Result: DONE（正式版 token/端口发现走 Runtime Host/native messaging，Phase J）

### §8.6 右键菜单
Code: `service-worker.js` — image/link/selection 三项，同一 CaptureRequest 契约；
创建带 `runtime.lastError` 守卫。
Result: DONE

### §8.7 Eagle 风格拖拽 dock
Code: `content-script.js` — dragstart 检测 draggable image/link 后显示瞬态 dock；
dock 按钮是真实 drop 目标（dragover/drop + hover 反馈），也保留点击兜底；
drop 发送一个 CaptureRequest；dragend 复位。dock 不持久化。
Result: DONE

### §8.8 截图捕获
Code: popup 截图走 `chrome.tabs.captureVisibleTab`（P0 viewport）。
整页拼接：**DEFERRED**（按方案"不做半成品"标记，README 已注明）。
Result: DONE（P0）/ DEFERRED（整页）

### §8.9 桌面快速捕获
桌面全局快捷键 + Runtime Host 托盘/浮动窗口：**NOT DONE**（Phase J / Remaining Debt）。

## Failure injection
- 非法 kind / 非法 mode / 非 schemaVersion 1 → 结构化拒绝（单测覆盖）。
- Core 不可用 → 提交抛错并回显错误信息（popup status）。
Result: PASS

## Restart evidence
- Core 重启（13:53）后扩展 token 路由可用；实时 HTTP 通过。

## Test suite
- 扩展单测 4/4（vitest）。
- `npm run check:fast` 全绿：web 358/358、core 379/379、domain 5/5、contracts 4/4、
  架构 104/104、lint（存量 warning）/typecheck/build 通过。

## Browser evidence
- 扩展需人工"加载已解压的扩展程序"后真机验证（popup/右键/dock 交互）。
  BROWSER ACCEPTANCE PENDING。

## Hidden-debt scan
改动文件关键词扫描：无新增隐藏欠账。

## Remaining Debt
- §8.9 桌面快速捕获（全局快捷键 / 文件 / 剪贴板 / 浮动窗口）→ Phase J
- Popup/右键"最近项目 chips"（项目亲和仍由 Core 决定，扩展不实现归属逻辑）
- 截图整页拼接（DEFERRED）
