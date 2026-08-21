# LCOS H-GUI Completion Gate｜逐项证据提交

> 日期：2026-08-11
> 对应审计：`LCOS_H_GUI_COMPLETION_GATE_20260811.md`
> 结论先行：**A-H 后端能力已闭环，但 GUI 完成度未达到本 Gate 的"全部 YES"。** 21 项中 DONE 9 / PARTIAL 8 / NOT DONE 4。以下逐项给出代码路径、提交与截图证据，缺口诚实标注。

---

## 证据基线

- 分支：`codex/backend-hardening-20260802`
- 提交：`0cc7a73`（Phase A）→ `4cca5b4`（Phase H）+ `6bd7eca`（v29 快照）+ `(chore: ignore)` 共 10 个
- 截图目录：`docs/audit/evidence-gui-20260811/`（真实浏览器 Playwright 渲染，Golden Project 数据）
- Golden Project：`project-lcos-gui-golden-a36b795d`（8 文本 + 3 URL + 5 图片/截图 + 3 本地文件(md/pdf/txt) + 1 对话 + 关系，28 views 已按网格分散）

| 截图 | 内容 |
| --- | --- |
| [01-project-home.png](evidence-gui-20260811/01-project-home.png) | Project Home（drive 列表 + Reveal 按钮） |
| [02-golden-canvas-1440.png](evidence-gui-20260811/02-golden-canvas-1440.png) | Golden 画布 1440×900（混合内容节点） |
| [03-tab-a-golden.png](evidence-gui-20260811/03-tab-a-golden.png) / [03-tab-b-other.png](evidence-gui-20260811/03-tab-b-other.png) | A/B 两个项目标签页并存 |
| [04-mixed-nodes-zoom.png](evidence-gui-20260811/04-mixed-nodes-zoom.png) | 节点区放大（text/url 卡） |
| [05-selection-relations.png](evidence-gui-20260811/05-selection-relations.png) | 选中节点（高亮/锚点） |
| [05b-immersive-doubleclick.png](evidence-gui-20260811/05b-immersive-doubleclick.png) | 双击 → ImmersiveViewer |
| [07-context-flow.png](evidence-gui-20260811/07-context-flow.png) / [08-outline.png](evidence-gui-20260811/08-outline.png) / [09-context-tree.png](evidence-gui-20260811/09-context-tree.png) | 轨迹 / 大纲 / 思维导图三投影 |
| [14-canvas-1366x768.png](evidence-gui-20260811/14-canvas-1366x768.png) | 1366×768 笔记本尺寸 |

---

## 逐项结论

### 1. Phase A GUI

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 1.1 Project Home 是 Launcher + 新标签页 | **PARTIAL** | `openProjectInNewTab`（App.tsx:1134）用 `window.open('?project=id')` 新标签页；A/B 独立实例互不覆盖（截图 03）。**但无 `/projects` 独立路由主页**——Project Drive 是 modal（`!projectOpen`），不是独立页面。 |
| 1.2 New Project 新 Tab | **PARTIAL** | `createProject` 后走 `openProject`（同实例），不强制新标签页；主页（drive）在创建后关闭。 |
| 1.3 Reveal Folder 两处 | **DONE** | ProjectStripVNext.tsx:27（`vnext-project-reveal`）+ ProjectDrive.tsx:75（`project-folder-reveal`）；后端 `POST /projects/:id/reveal` 只放行已注册 root；截图 01 中可看到卡片按钮。 |
| 1.4 Zero Naming | **DONE** | ScopeCreateDialog.tsx:50（"名称（可选）/留空稍后自动命名"/"立即创建"）、WorkspaceDialog.tsx:41（创建模式不禁用）；TitleMode auto/manual/locked 后端 v24 + `POST /entities/:type/:id/title`；节点改名写 Core manual（App.tsx renameNodeTitle）。 |

### 2. Phase B GUI

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 2.1/2.2 Capture 无 Picker + 不确定进 Staging | **DONE** | Affinity Resolver（project-affinity-service.ts）≥0.8 直接进项目、<0.8 staging；浏览器扩展/CLI capture 无任何项目选择 UI；staging 立即成功。 |
| 2.3 Pending 轻量显示 | **DONE** | ProjectDrive `stagingPendingCount` 显示"最近捕获 · N 项等待整理"（纯展示卡），无 Inbox 页面。 |
| 2.4 Pinned Capture Target 用户可见/可切换 | **NOT DONE** | 只有 CLI/API（`lcos project pin-capture`）；GUI 无 pinned 状态显示或切换入口。 |

### 3. Phase C GUI（审计点名最缺证据的一块）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 3.1 CanvasNodeVisual Content-first | **DONE** | visualFamilyFor（visualFamily.ts）+ 缩略图/正文摘要渲染（CanvasNodeVisual.tsx:103-109）；截图 02/04 节点显示内容前缀"FBK客户反馈…"，class `visual-family-feedback`。 |
| 3.2 Preview 自动、非用户操作 | **PARTIAL** | previewUrl/previewDataUrl 自动显示 ✓；但 App.tsx:2050 `generatePreview` 仍在菜单路径（"生成预览"按钮未完全退出主入口）。 |
| 3.3 ResourceDetailDialog 只保留内容/来源/打开/相关 | **PARTIAL** | 文案已清（"资源详情"）；但 artifactViewerRegistry.tsx:227 仍渲染"预览状态 / not-generated"等工程字段。 |
| 3.4 ImmersiveViewer 双击同源 | **DONE** | 双击进 viewer（截图 05b）；Canvas 与 viewer 共用 `artifactViewerRegistry`。 |
| 3.5 Capture Spawn Zone 稳定新捕获区域 | **NOT DONE** | `SPAWN_ZONE = {480,240}` 常量（capture-application-service.ts:21），**连续 Capture 全部叠在同一点**——实测 28 个视图重叠（已用 API 手动散开才可截图）；需 Presentation Engine 碰撞/区域接管。 |

### 4. Phase D GUI

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 4.1 visualFamily 取代业务 heuristic | **DONE** | CanvasNodeVisual 用 `visualFamilyFor` 决定渲染；节点 class `visual-family-*`。 |
| 4.2 Node 空字段隐藏 | **NOT DONE** | NodeInfoPopover.tsx:41-48 常显"版本/来源/流程/Preview"，空值时显示"没有关联执行记录/not-generated"；revisionId 直接展示。 |
| 4.3 Relation 三层视觉分离 | **PARTIAL** | Contract 有 presentationEdges（curation-patch.ts:38）+ domain relations origin；**无三层视觉区分实现证据**。 |
| 4.4 Edge LOD 大画布可读 | **PARTIAL** | spatialLod.ts 契约存在；SpatialEdgeLayer 无明确 zoom/hover LOD 逻辑证据，50+ 节点可读性未验证。 |
| 4.5 Anchored Note 定位 | **NOT DONE** | 无 anchorRefs 字段/交互实现。 |
| 4.6 Selection 邻近操作 | **PARTIAL** | SelectionComposer 有 Agent 输入 + workspace 操作；**无 Create Context / Relate / Reorganize 入口**。 |
| 4.7 Context/Workflow 一动作创建 | **PARTIAL** | WorkflowSurface 有 selection→start；Context 即时创建走子画布（createScopeFromSelection），无"选中→新建 Context"独立一步。 |
| 4.8/4.9 Outline/MindMap 同 hierarchy + Renderer 切换 | **PARTIAL** | 三投影截图有效（07/08/09），ProjectionSurfaces 注释"share Project Truth"；但 hierarchy 状态仍在前端内存（presentationHierarchyState），未落 Core presentation_views。 |

### 5. Phase H GUI

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 5.1 Shell 去重 | **PARTIAL** | V07TopBar 仅 import 未渲染（死代码）；ProjectStripVNext（AppShellView:44）+ WorkspaceRailVNext（CanvasSceneHost:42）+ WorkRailHost（AppShellView:46）并存，职责需真人评审。 |
| 5.2 WorkRail/ArtifactWorkbench/PreviewSurface 职责 | **PARTIAL** | 三者并存，未完成职责划分审计。 |
| 5.3 AgentContextSurface 不挡画布 + 不高频轮询 | **PARTIAL** | 默认折叠胶囊 ✓（AgentContextSurface.tsx collapsed state）；但 App.tsx:672 `setInterval(..., 3_000)` 轮询仍在。 |
| 5.4 Diagnostics 隐藏 | **DONE** | main.tsx:12 仅 `/__diagnostics` + DEV 路由。 |
| 5.5 Version/Engineering noise | **NOT DONE** | NodeInfoPopover 显示 Revision ID / previewStatus；AgentContextSurface 显示 `v{version}`。 |
| 5.6/5.7 文案 + Skill CTA | **DONE** | 全仓未匹配"项目阶段/下一步/先选 Skill/Start Skill"；WorkflowSurface 文案为"自由工作结构"。 |
| 5.8 Source Picker 非必经 | **PARTIAL** | 无强制选择器 UI；但 Context 来源仍是前端内存 `contextPresentationIds`，未完全自动装配到 Core。 |
| 5.9 MiniMap/Zoom | **PARTIAL** | CanvasMiniMap 存在、zoom 控件存在；"不盖住节点/更轻"未真人确认（历史边框遮挡问题未复测）。 |
| 5.10 13-14 寸屏 | **DONE** | 截图 14（1366×768）正常渲染 Project Strip/画布。 |

---

## 未达到 Gate 的明确缺口（NOT DONE 汇总）

1. **Capture Spawn Zone**：连续 Capture 全叠同一点（实测），需要 Presentation Engine 分配新捕获区域。
2. **Node 空字段/工程噪音**：来源/流程/Preview/Revision ID 空值常显，违反"有值才显示"。
3. **Anchored Note**：飞书式锚定定位未实现。
4. **Pinned Capture Target UI**：只有 CLI，GUI 无状态显示/切换。
5. **Reorganize Ghost GUI**：后端 proposal/preview/apply/rollback 已可用，但前端未接入"Before → Ghost After → Apply"（审计 4.x 隐含项，Phase H 汇报中已诚实列为未做）。

## 建议

这 5 个缺口需要一个小轮次（GUI 收口 II）补齐后再宣称 A-H Product Capability Complete；其中 Spawn Zone 与 Reorganize Ghost 是后端已就绪、前端接线问题，工作量可控。

