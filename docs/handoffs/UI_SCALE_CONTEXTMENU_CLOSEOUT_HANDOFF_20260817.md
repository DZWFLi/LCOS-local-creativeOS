# UI 独立缩放 + 右键手势收口 · 交接 2026-08-17

## 1. 任务摘要

在 Frontend Redesign Pass 1（未提交）基础上继续收口用户手测提出的三个问题：

1. Edge/Chromium 原生右键菜单仍与 LCOS 语义右键（节点右拖 Drop、画布右键卡片）冲突；
2. 新增的 Ctrl/Cmd+滚轮 UI 缩放只放大图标/内容，侧栏、底栏的「底子」（容器几何）不跟随，画布与侧栏互相压盖；
3. 画布之上的节点控制浮层（多选工具条、右键卡片、单点详情卡、边控件等）没有跟随同一比例缩放。

本次全部改在 `.worktrees/mvp-fast-build` 工作树内，**仍未提交**（等 Dz 手测确认后拆 `merge` + `fix` 两个 commit，不 push）。

## 2. 实际范围

- 右键手势：补全浮层/边线的 `contextmenu` 压制；保留全局 capture 压制与语义右拖守卫的「压制一次后自移除」逻辑。
- UI 缩放几何：rail/dock 容器继续用 `zoom`（布局盒与自身偏移一起放大，底子跟着变）；surface host 让位改用按比例计算的几何别名 `--lcos-ui-rail-w` / `--lcos-ui-dock-h`。
- 浮层缩放：画布之上的控件用 `transform: scale(var(--lcos-ui-scale))`（zoom 会把绝对定位锚点一起放大导致漂移，transform 不会），并保留各自原有反画布缩放。
- 修掉两处旧布局干扰：vnext 旧浮动 rail 的 `max-height: calc(100% - 142px)` 钳短全高 rail；vnext 用 `top` 锚定 dock 导致 zoom 后不贴底。

## 3. 变更前后流程

### 右键手势

```text
变更前：pointerup 即摘除守卫 → Chrome 在 pointerup 之后才派发 contextmenu → 原生菜单复现
变更后：守卫压制一次后自移除 + 300ms 兜底移除；宿主层 contextmenu 无条件 preventDefault 并打开自定义菜单；
        portal 浮层（NodeInfoPopover 等）自带 onContextMenu；全局 capture 仍压制非输入框的右键默认行为
```

### UI 缩放

```text
变更前：rail/dock 容器 zoom → 底子变大，但 surface host 仍按未缩放宽度/高度让位 → 侧栏/底栏压住画布
变更后：
  --lcos-ui-rail-w = calc(var(--lcos-rail-w) * var(--lcos-ui-scale))
  --lcos-ui-dock-h = calc(var(--lcos-dock-h) * var(--lcos-ui-scale))
  rail/dock 容器 zoom（底子+图标一起变）
  surface host left/bottom 用缩放别名让位
  sidecar host inset 底部也用缩放别名
  浮层控件 transform: scale（锚点不漂移；工具条/边控件保留 ÷canvas-zoom 的反向补偿）
```

## 4. 修改文件

### 本次收口新增

- `apps/web/src/App.tsx` — uiScale 持久化时同时写 `documentElement --lcos-ui-scale`（portal 到 body 的浮层可解析）
- `apps/web/src/product-interface.css` — 几何别名、浮层 transform 缩放、composer scale 变量接线、node-info-popover 入场动画终点对齐、sidecar host inset 缩放、删掉错误的 dock translateY 补偿
- `apps/web/src/reconstruction.css` — surface host 让位用缩放别名；rail `max-height:none`；dock `top:auto`（贴底）
- `apps/web/src/features/canvas/ProjectCanvas.tsx` — selection-toolbar / anchor-create-menu / EdgePath 边线补 contextmenu 压制

### 之前已改（本交接覆盖范围内）

- `semanticRightDrop.ts` / `ProjectCanvas.tsx` 语义右拖守卫时序
- `CanvasSceneHost.tsx` 宿主 contextmenu + canvas-hud
- `WorkspaceRailVNext.tsx` / `SurfaceDock.tsx` / `WorkRail.tsx` / `SurfaceContextMenu.tsx` / `NodeInfoPopover.tsx` / `SelectionComposer.tsx` 右键压制
- Pass1 全部改动（见工作树 `git status`，另有 `BUILD_INFO_FRONTEND_REDESIGN_PASS1_20260817.md`）

## 5. 测试结果

| 检查项 | 结果 |
| --- | --- |
| `npm run typecheck`（web/core/domain/contracts） | 全绿 |
| `npm run test --workspace @local-creative-os/web` | 462/462 通过 |
| `npm run build` | 通过（chunk 大小警告为既有项） |
| `npm run test:e2e` | 20/20 通过（干净环境下重跑；先前的 3 个失败为与运行中栈的端口/鉴权冲突，非代码回归） |

### Playwright 实测证据（dev 栈，1440×900）

- 桌面模式 scale 1.28：rail 56→71.7px，host left 71.7px（完全对齐）；dock 72→92.2px 且贴底，rail bottom == dock top == 807.8px
- sidecar 模式 scale 1.28：dock 52→66.5px 贴底，host bottom == dock top == 833.5px
- 浮层：右键菜单 transform=1.28（锚点保持）；多选工具条 = (1/canvasZoom)×1.28；composer=1.28（top-left 锚点）；node-info-popover 入场动画终点即 1.28，无跳变
- 交互：Ctrl+滚轮在侧栏/底栏 1→1.05（shell 与 documentElement 同步更新）；在画布上滚轮不触发 UI 缩放
- 右键：canvas / selection-toolbar / node-info-popover 上派发的 contextmenu 均 defaultPrevented=true

## 6. 栈状态（恢复说明）

E2E 需要独占 43121，临时停了手测栈并已按原样拉回：

| 服务 | 端口 | 启动方式 |
| --- | --- | --- |
| Local Core | 43121 | `node apps/local-core/dist/index.js`，`LOCAL_CORE_DB_PATH=.codex-runtime/handtest.sqlite`（**必须**，用户项目 `project-1-14625f75` 在此库） |
| Light Bridge | 43122 | `tools/light-bridge-kernel/.codex-runtime/bridge-test-venv/Scripts/python.exe -m lcos_bridge serve`，PYTHONPATH=tools/light-bridge-kernel/src |
| Vite | 5173 | cwd=apps/web，`node ../../node_modules/vite/bin/vite.js --host 127.0.0.1`，带 `LOCAL_CORE_API_TOKEN`（.codex-runtime/local-core-token） |

日志：`.codex-runtime/devlogs/{core,bridge,web}.{out,err}.log`。验证过 `/projects/project-1-14625f75?surface=companion` 正常打开，8 节点画布与 sidecar 布局在。

## 7. 风险 / 未完成

- 未提交：全部改动仍在 worktree（HEAD `950acba`，分支 `codex/r1-vision-merge-20260812`）。
- `capability-popover` 未接入缩放：它是 dock 拉起的完整工作流面板，sidecar 下有专门布局，缩放会破坏其排版；如 Dz 要求可后续单独处理。
- 单点详情卡（node-info-popover）经合成元素验证 transform/动画正确，真实节点上单点是否弹出由 Dz 手测确认。
- 侧栏 hover 预览卡（vnext-workspace-preview）随 rail zoom 缩放，未单独验证双列模式下的偏移。
- `zoom` 在部分 WebView 可能不生效（Edge/Chrome 均支持）；如需兼容再退化为 transform+几何变量方案。

## 8. 下一步

1. Dz 刷新手测：右键不再弹原生菜单；Ctrl/Cmd+滚轮在侧栏/底栏调节整体 UI 缩放；多选/右键/单点卡片跟随缩放。
2. 确认后拆两个 commit（Pass1 merge + 本次 fix），不 push。
3. 按需打包最新前端包（沿用 8.16 全栈包流程）。

## 9. 回滚

未提交，`git checkout -- apps/web/src/...` 可整体放弃；或保留 Pass1、仅回退本次 4 个文件：
`App.tsx`、`product-interface.css`、`reconstruction.css`、`ProjectCanvas.tsx`。
CSS 改动互不依赖历史迁移，无 schema 变更；Core 数据未动（仅重启进程）。
