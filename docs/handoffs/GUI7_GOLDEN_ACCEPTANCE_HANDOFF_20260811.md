# GUI-II-7 Handoff｜Golden Product Acceptance（真实 145 节点项目）

## Status
COMPLETE

## Before

- GUI 只能拿 MVP Sample（2906 视图，过量）或 28 视图小样本验收，从未有符合规格的 120–150 节点 Golden Project。
- Gate 关键缺口（Capture 重叠、Node 噪音、Anchored Note、Pinned Capture UI、Reorganize Ghost）在 GUI-1..6 已陆续闭环，但未做整机 Golden 验收。

## Golden Project 种子（真实、可复现）

`node .codex-runtime/gui7-seed.mjs`

- 项目：`project-lcos-golden-gate-2026-08-17314dfd`（本轮最终证据版）
- 根目录：`%TEMP%\lcos-gui7-golden-<rand>`（143 个真实文件：5 截图 + 5 图片 + 5 PDF + 10 文本 + 1 Skill + 3 网页 + 2 对话 + 2 Run 输出 + 2 Context + 2 Workflow + 58 资料 + 45 灵感 + 3 决策备注）
- 快照：143 artifact+view、25 关系、2 Core Note、2 workspace、5 scope、presentation（hierarchy + 3 pins + 全量 positions）
- 全部走 Core REST（POST /projects → PUT /graph → PUT /presentations → POST previews），跨项目归属守卫验证通过

## Real browser acceptance（25/25 PASS）

`node .codex-runtime/gui7-verify.mjs`

| 行为 | 结果 |
|---|---|
| Launcher 列出黄金项目 + 多项目 | PASS（58 卡片） |
| 145 节点渲染（143 视图 + 2 备注） | PASS |
| 全部渲染节点零重叠 | PASS（0/145） |
| 图片/PDF/URL/文本四种节点近景 | PASS（真实预览） |
| 近场 selection toolbar（Agent/整理/上下文…） | PASS |
| 单选局部关系高亮 | PASS（focused=2） |
| Anchored Note 定位 + 脉冲 | PASS |
| 20 个捕获节点零重叠 | PASS（0/20） |
| Reorganize Ghost → Apply → Safe Revert | PASS（且 graph 位置零污染） |
| Immersive Viewer 双击打开 | PASS |
| reload 后 145 节点与备注恢复 | PASS |
| 1366×768 壳可用、无页面级溢出 | PASS |
| Outline / MindMap / Graph / Context / Workflow 投影 | PASS |
| Agent 胶囊展开 | PASS |

## Screenshots（21 张矩阵）

`.codex-runtime/gui7-01-launcher.png` … `gui7-17-immersive.png`，覆盖 1440×900 主流程、1366×768 硬门、1920×1080 宽屏。

## 本轮发现并修复的隐藏欠账（Discovered Debt）

### 1. 丢失 pointerup 后 auto-pan 静默拖动节点（并写进 graph）

- 现象：自动化验证中发现某次 selection 后节点位置被写入 ghost 值；经调用栈定位是「pointerdown 后未收到 pointerup → drag 状态滞留 → 之后任意鼠标移动 >4px 即开始拖动 → 移到画布边缘触发 auto-pan → 节点被拖动 → 自动保存写成 move_artifact_view」。
- 修复：`ProjectCanvas.onPointerMove` 增加安全阀——存在进行中 drag/resize/workspace/frame 交互但主键未按住时，`finishPointer(event, true)`（取消并还原原位）。
- 证据：修复后完整 GUI-7（含 Reorganize apply/revert）跑完，graph 中 doc-010/011/012 位置仍为原始网格值。

### 2. Workflow 表面 presentation 无限保存回环（版本暴涨 + Maximum update depth）

- 现象：打开工作流 lens 后 `presentation:workflow` 版本以 ~30 次/秒增长（一次运行从 44 → 数百），伴随 `Maximum update depth exceeded`。
- 根因：`ProjectionSurface` 每次渲染都调用 `resolveWorkflowView/resolveContextView`，返回全新 `edges`/`nodes` 数组；`WorkflowSurface` 的「合并 canonical 边」effect 依赖 `props.edges` 身份，于是每帧重跑 → 每帧 setPresentationEdges → mirror → save → SSE → 重渲染 → 新数组 → 死循环。
- 修复：`ProjectionSurfaces.tsx` 将 intent/context/workflow 解析 `useMemo` 化（history 用模块级空常量，避免 `?? []` 破坏 memo）。
- 证据：修复后打开工作流 lens 8 秒仅 1 次 PUT、0 深度错误；最终黄金项目 workflow presentation version = 1。

### 3. DialogsHost 数组渲染缺失 key（React 警告）

- `extraDialogs` 作为 fragment 放进数组导致 key 警告；改为数组外并列渲染，警告消失。

## Tests

- web：296/296（runtimeBridge 新增 3 用例）
- core：362/362；架构：104/104；domain/contracts 通过
- `npm run check:fast` 全绿（lint → typecheck → 测试 → arch → build）

## Persistence / Transaction / Concurrency semantics

- Reorganize：Proposal → Ghost（transient layoutPreview，绝不写 Core）→ Apply（ChangeSet + safe revert）→ Revert（fingerprint 校验后还原 beforeState）。本轮确认 apply/revert 前后 graph 位置完全一致。
- Note 投影：只读；diff 排除 note kind。
- Presentation：memo 化后无回环；SSE 推送正常。

## Failure / Restart evidence

- Reload（浏览器刷新）后 145 节点 + 备注 + presentation 恢复。
- Core 重启未在本轮单独重测（GUI-6/此前 HU-3A 已覆盖重启恢复路径；如实标注）。

## Explicitly not implemented（不在本阶段范围）

- 1366×768 物理真机（无此分辨率屏幕，用 Playwright viewport 硬门验证）。
- Golden 项目中 Run 的真实执行（运行链路此前 E2E 已验，本轮只验证 Run 节点/Agent 胶囊呈现）。

## Remaining
NONE（GUI II 范围）；Phase I/J 按原计划继续。

## Commit
见本轮提交 `dfd816f` 之后的增量提交（Anchored Note 修正 + auto-pan 安全阀 + presentation memo 化 + DialogsHost key）。
