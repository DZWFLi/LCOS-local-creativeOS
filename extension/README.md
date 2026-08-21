# LCOS Capture 扩展（MV3）

## 0.1 权威行为

**默认目标是系统级 Capture Space。** 扩展只负责把页面、选区、图片、链接或截图送入 LCOS Capture；它不替用户决定项目归属，也不再唤醒旧的 PowerShell Capture Assistant。

Capture Space 是项目之前的暂存画布：

```text
网页 / Agent / 截图 / 链接
        ↓
LCOS Capture
        ↓
Capture Space
        ↓
AI 整理 / 用户整理
        ↓
Semantic Drop → 已有 Project
```

## 安装（开发加载）

1. 打开 Chrome/Edge `chrome://extensions`（Edge：`edge://extensions`）
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本目录（`extension/`）

## 功能

- Popup：页面 / 选区 / 截图 → Capture Space
- Popup「剪贴板」：Snipaste / 系统截图进剪贴板后直接捕获 → Capture Space
- 右键菜单：图片 / 链接 / 选区 → Capture Space
- 页面拖拽 dock：**鼠标左键按住**页面里的图片或链接，拖到底部 dock，松手即收进 Capture Space。右键、中键不触发 dock，避免和浏览器鼠标手势 / LCOS Semantic Drop 打架。
- 截图：`chrome.tabs.captureVisibleTab`（仅可视区域；整页拼接 DEFERRED）

> 历史 `43123/wake + capture-assistant.ps1` 路线已在 PASS7 退役。正式 Desktop 使用常驻 Electron CaptureWindow。

## 故障自检

- 刷新扩展后必须**刷新网页**（Ctrl+F5），内容脚本才会注入已打开的页面。
- 打开页面 DevTools 控制台输入 `window.__LCOS_CAPTURE_EXTENSION__`：
  - 返回 `true` = 扩展已注入；
  - 返回 `undefined` = 未注入（先 Ctrl+F5，或到 `edge://extensions` 确认扩展已启用）。

## 工作原理

扩展只构造 `CaptureRequestV1` 并调用本机 `http://127.0.0.1:43121/capture/v1`：

1. `POST /runtime/extension-token`（免 core Bearer，仅本机回环）取得扩展 token
2. 携带 `x-lcos-token` 提交捕获，默认 `target.mode = staging`
3. Core 做 token/origin/大小/opId 校验并写入 Capture Staging / blob cache
4. Core 可以计算 project affinity 作为 Capture Space 的弱建议，但不会自动归项目

Core 是唯一路由权威：扩展不接触项目数据，也不做项目归属决策。

## 安全边界

- 扩展 token 仅用于提交捕获（低风险、本机回环）
- 正式版仍可由 Runtime Host / native messaging 进一步收紧 token 下发
- 截图整页拼接未实现，保持 DEFERRED，不做半成品
