# LCOS 0.1 Desktop + Capture Standalone Baseline PASS8 · Build Info

日期：2026-08-18
状态：SOURCE BASELINE COMPLETE / WINDOWS FULL QA PENDING

## 目的

把 S10 后全栈产品化源码、PASS6 Electron Desktop、PASS7 Capture convergence 收成一份无需历史 merge 的新源码基线。

## Electron

包含：

- Main BrowserWindow
- 独立 Capture BrowserWindow
- contextIsolation / sandbox preload bridge
- Runtime Supervisor
- Core 43121 / Bridge 43122 生命周期
- static web host + authenticated Core proxy
- Tray
- Native directory picker / reveal
- Codex managed MCP + Skills integration
- Runtime token / log / disk / port guard
- Forge Squirrel.Windows / zip maker
- bundled Bridge Windows build script

PASS8 额外：Capture Float 保存窗口位置；显示器布局变化时回落到有效屏幕；Codex managed runtime 更新时先清旧副本。

## Capture

- Capture 默认 staging
- Capture Space 是系统级轻量 Canvas
- Capture Presentation 持久化
- AI 只在 Capture Space 匹配/分组/摆放
- Capture Float 收文件/文字/URL
- Capture → Existing Project materialize + ImportBatch
- Project 原节点不因投送自动移动

## Standalone bootstrap

新增：

```bash
npm run baseline:bootstrap
npm run desktop:doctor
```

当前快照不包含 node_modules。容器无法访问 npm registry（EAI_AGAIN），所以 Desktop workspace lockfile 不能在本环境刷新；第一次联网 Windows bootstrap 会完成它。

## Source Gate

- Electron / Desktop scripts `node --check`: PASS
- PASS8 JSON parse: PASS
- Desktop source doctor: PASS（正确提示 lock/node_modules 尚未 bootstrap）
- TS / TSX syntactic transpile: 302 / 302 PASS
- Runtime ports 43121 / 43122 在打包环境：FREE
- `node_modules`: intentionally excluded

## 未宣称通过

- Full TypeScript typecheck
- Vitest / Playwright
- Web production build
- Real Windows Electron run
- PyInstaller Bridge build
- Squirrel make / installer

这些必须在 Codex 的联网 Windows 新工作树完成。
