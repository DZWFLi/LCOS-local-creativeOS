# LCOS vNext 全栈合并报告（2026-08-07）

## 1. 基线

- Destination / Source of Truth：`mvp-fast-build` worktree（对应 `lcos-app-fullstack-20260806` 最新全栈的仓库状态）
- Branch：`codex/backend-hardening-20260802`
- 起始 HEAD：`c4b2d3b`；最终 HEAD：`0b061fc`
- UI donor：`frontend-package-20260807-vnext-surface-drop-workbench.zip`（只迁 9 个新组件，不迁旧身体）
- 视觉参考：`正式版原型2.zip`（只取方向，不取 Scene/ObjectKind 假模型）

## 2. 提交记录

| Commit | 内容 |
| --- | --- |
| `9e89c50` | N0 Backend Delta 审计（B1–B9 证据）+ donor 新件入库 |
| `9d34778` | F1–F4 接线：strip/rail/surfaces/drop/workbench/immersive + 契约测试更新 |
| `0b061fc` | 运行时验证修复：scene top、DropShelf 去重、image viewer kind |

## 3. 迁移清单（F1–F5）

### F1 Shell + SurfaceHost ✅

- `ProjectStripVNext` 替换 `V07TopBar`（多项目切换收敛到 Drive，`closeProjectTab` 逻辑保留）
- `WorkspaceRailVNext` 替换 `WorkspaceDock`（更多菜单补回编辑/复制/删除/保存现场/历史/上移下移）
- `SurfaceDock` 底部 Scope + Lens 导航
- `ProjectionSurfaces`：outline / context-flow / context-tree / context-graph / work / deliver 六种投影，同一 Project Truth、独立布局
- 切换 Lens 不移动 Arrange 坐标（`vnext-surface-host` 条件渲染，Arrange 原样保留）

### F2 Selection + Composer ✅

- `SurfaceComposerBar` 在非 Arrange 投影 + 有选择时出现
- Composer 只暴露 Operation（分析/创建/修改）+ Agent（Auto/WorkBuddy/Codex）+ Result（回复/新内容/新 Draft）
- 不暴露 Target ID / Revision ID / Session ID / Runtime root（Playwright 文本验证）
- 单选/多选语义保持（单选=节点+一跳，多选=严格 Selected IDs，沿用现有 `selectionContextIds`）

### F3 Dual Drop + Workbench ✅

- Left Gutter + Bottom Gutter 拖放（`drop-gutter` 视觉 + `dropAnchorAt` 判定）
- Selection Toolbar "投送"按钮（bottom anchor）
- `DropShelf` 目的地：当前现场 / 工作空间 / 子画布 / 主画布，Send 与 Send & Follow
- Workbench：`collection` scope + View Reference（不复制 Artifact），Merge 只并稳定结果并复位引用
- Stage 前不修改 Canonical Truth（拖动还原 `originals`）
- 真实浏览器验证：多选 → 投送 → 当前现场 → Merge → 返回主画布 ✅

### F4 文件节点 + Viewer ✅

- `ImmersiveViewer` 接入（图片/PDF/PPT/音视频双击全屏，Esc/点击外部关闭，链接外部打开）
- 修复：`ArtifactKind 'image'` 未进 viewer 识别列表 → 图片节点无法沉浸预览（已修）
- MD/TXT 走 workbench Reader；不支持的格式走诚实 fallback

### F5 Context / Work / Deliver ✅（真实数据）

- work / deliver / tree / graph 全部消费 `visibleNodes/visibleEdges` 真实数据（Playwright 验证 6–9 个节点）
- 会话 / Run / Revision 数据来自 runtime graph（Runtime source 徽标可见）

## 4. 未迁移的 donor 文件与原因

| 文件 | 原因 |
| --- | --- |
| donor `App.tsx`（2571 行） | 单体旧基线，依赖 qa-fixtures 进生产；我们保留拆分后的宿主 |
| `qa-fixtures/**` | 已从生产路径移除（8/6），donor 会召回空目录白屏 bug |
| donor `model.ts` / `localCoreClient.ts` / `runtime/*` | 0.7.3 旧接口，缺 conversation/semantic/activeContext |
| donor `package.json` / lockfile | 0.7.3 旧依赖图，不回退 |
| donor `surface.css`（整体） | 视觉语言已由 vnext.css 承载；需要的规则按需摘取 |
| 原型2 `Scene` / `ObjectKind` | Camera+Selection+Version 融合体，违反 Workspace 边界；假模型不当契约 |
| 原型2 仅 Left Drop | Bottom Drop 是正式需求（已实现） |

## 5. Backend Delta（详见 `docs/architecture/BACKEND_DELTA_FOR_VNEXT_GUI_20260807.md`）

| GAP | 判定 |
| --- | --- |
| B1 Workspace Frame Bounds | **已完成**（schema v19 + update_workspace_frame CAS + 前端拖拽/缩放/刷新恢复，浏览器 7/7 验证） |
| B2 Aggregate Relation Endpoint | **已完成**（view/workspace 端点 + 测试） |
| B3 Projection Layout Store | FRONTEND_ONLY（前端视图状态） |
| B4 Workbench Branch/Merge | **已完成**（WorkbenchService Core 收口 + 前端 runtime 分支） |
| B5 ContextSnapshot History | **已完成**（create/compare/branch + 路由） |
| B6 Session/Handoff 终局合同 | **已完成**（HandoffRecord + 三态 + 路由，schema v20） |
| B7 ActiveContext 多 Agent 隔离 | **已完成**（sessionId 归因） |
| B8 Run Proposal/Composer 对齐 | EXISTS（runtime-proposal-service） |
| B9 UI Agent Command Surface | **已完成**（temporary-workbench kind） |

## 6. Schema / API / MCP 变化

- Schema migrations：**无新增**（本轮不改后端表）
- API / Contract：无新增；前端使用现有 `/projects/:id/graph`、workspace-memberships、active-context 等
- MCP tool surface：**保持 37/8 不回退**（未动 MCP）

## 7. 前端变更文件

新增：

- `features/shell/ProjectStripVNext.tsx`、`SurfaceDock.tsx`、`WorkspaceRailVNext.tsx`
- `features/surfaces/ProjectionSurfaces.tsx`、`SurfaceComposerBar.tsx`
- `features/drop/DropShelf.tsx`
- `features/viewer/ImmersiveViewer.tsx`
- `state/appWorkingStore.ts`（已跟踪，未改）
- `vnext.css`

修改：

- `App.tsx`（strip/rail/surface/composer/drop/workbench/immersive 接线 + intent/resultPolicy 状态）
- `features/shell/AppShellView.tsx`、`CanvasSceneHost.tsx`
- `features/canvas/ProjectCanvas.tsx`（dual drop gutters + stage transfer + originals restore）
- `features/viewer/artifactViewerRegistry.tsx`（image kind 修复）
- 契约测试 2 个（指向 vNext 宿主，语义等价）

## 8. 测试命令与真实结果

```text
npm run check:fast
  lint ✅ → typecheck ✅ → web 134/134 ✅ → core 252/252 ✅ → architecture 70/70 ✅ → build ✅
```

Playwright 真实浏览器（1600×1000，headless Chromium）：

```text
vnext-gui-check：14/14 PASS
  strip / rail / bottom dock / surface-host / canvas / mini-map 渲染
  context-flow / outline 投影切换，arrange 恢复，Escape 无崩溃
vnext-interaction-check：14/14 PASS
  多选 → 投送按钮 → DropShelf → 当前现场 → 进入 Workbench → 投影视图 → Merge 回主画布
  图片双击 → ImmersiveViewer → Esc 关闭
  投影面选择 → SurfaceComposerBar（仅 Operation/Agent/Result）
  布局：strip 0–44 / scene 44–1000 / dock 贴底
vnext-surface-check：7/7 PASS
  work / deliver / tree / graph 全渲染真实节点
```

## 9. Windows / 环境说明

- 开发栈已用固定 token 启动：Core `43121`、Bridge `43122`、Web `5173`（token 文件 `.codex-runtime/local-core-token`）
- sample 项目已通过 `POST /projects`（intent=open + importExisting）打开
- dev-stack.mjs 随机 token 的问题：直接启动时 Core 用随机 token、vite 用文件 token 会 401；已改为显式传 `LOCAL_CORE_API_TOKEN` 启动

## 10. 剩余风险与下一步

- **B1 frameBounds 持久化**：已完成
- **B2/B4/B5/B6/B7/B9 后端缺口**：已完成（2026-08-07 第二批），剩余仅 B3（FRONTEND_ONLY）与 B8（本就 EXISTS）
- **Workbench Merge 通知文案**：当目标已存在引用时提示"0 个新稳定结果"略误导（功能正确，建议改为"已复位 N 个引用"）
- **多项目 tabs**：顶部收敛为单项目条，多项目切换走 Drive（设计方向，记录在案）
- **MCP 端到端**：本轮未重跑 `test:lcos-mcp-e2e`（需 bridge-test-venv 环境变量）；MCP 面未动
- **后端 N1–N5 施工**：按 `BACKEND_DELTA_FOR_VNEXT_GUI` 顺序推进（frameBounds → ActiveContext 归因 → Workbench merge 服务 → ContextSnapshot → Handoff → Projection View State → MCP 最终瘦身）

## 11. 一句话总结

> 以 20260806 全栈为身体、20260807 前端包为器官的合并已完成并通过真实浏览器验证；后端未动 schema/MCP，增量全部以审计报告形式冻结，等待 N1 施工。
