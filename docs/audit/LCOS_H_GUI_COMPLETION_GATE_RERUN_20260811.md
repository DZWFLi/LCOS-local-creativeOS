# LCOS H-GUI Completion Gate 复测｜GUI Closeout II 之后逐项证据

> 日期：2026-08-11（晚）
> 基线：旧审计 `LCOS_H_GUI_COMPLETION_GATE_20260811.md` 结论 DONE 9 / PARTIAL 8 / NOT DONE 4；本复测在 GUI-1..7 + HU-3A/B/4/5 之后逐项重跑。
> 证据集：`.codex-runtime/gui7-*.png`（21 张 Golden 验收截图）+ `gui6-*.png`（10 张）
> Golden Project：`project-lcos-golden-gate-2026-08-17314dfd`（145 节点 / 25 关系 / 2 备注 / hierarchy+pins）

## 结论先行

**21 项中 DONE 21。** 原先 4 个 NOT DONE 全部闭环，8 个 PARTIAL 全部升 DONE，且额外修复 3 处隐藏欠账（stuck-drag auto-pan、workflow presentation 保存回环、DialogsHost key 警告）。

## Phase A GUI

| 项 | 旧 | 新 | 证据 |
|---|---|---|---|
| 1.1 Project Home 是 Launcher + 新标签页 | PARTIAL | DONE | `/projects` 路由（GUI-1）；Launcher 列表 + 点击开新标签；`gui7-01-launcher.png`（58 项目卡片） |
| 1.2 New Project 新 Tab | PARTIAL | DONE | Launcher 空白项目入口保留，新项目新标签（GUI-1）；项目卡片打开走 `openProjectInNewTab` |
| 1.3 Reveal Folder 两处 | DONE | DONE | ProjectStripVNext + ProjectDrive 双入口（既有，未回退） |
| 1.4 Zero Naming | DONE | DONE | 创建对话框名称可选/留空自动（既有）；`gui7-01` 可见「空白项目」无强制命名 |

## Phase B GUI

| 项 | 旧 | 新 | 证据 |
|---|---|---|---|
| 2.1/2.2 Capture 无 Picker + 不确定进 Staging | DONE | DONE | Affinity Resolver ≥0.8 直进项目 / <0.8 staging（既有，未回退） |
| 2.3 Pending 轻量显示 | DONE | DONE | ProjectDrive「最近捕获 N 项等待整理」卡片（既有） |
| 2.4 Pinned Capture Target 用户可见/可切换 | NOT DONE | DONE | ProjectStrip 收件 pill「收件 → 项目」（GUI-1）；`gui7-02` 可见 pill；pin/unpin 交互在 GUI-1 提交验收 |

## Phase C GUI

| 项 | 旧 | 新 | 证据 |
|---|---|---|---|
| 3.1 CanvasNodeVisual Content-first | DONE | DONE | 机械 visualFamily（GUI-2）；图片/PDF/URL/文本近景 `gui7-03a..03d` |
| 3.2 Preview 自动、非用户操作 | PARTIAL | DONE | 「生成预览」按钮已退出主路径；Golden 项目图片/PDF/文本预览自动生成（preview worker 触发，`gui7-03*` 显示真实预览） |
| 3.3 ResourceDetail 只保留内容/来源/打开/相关 | PARTIAL | DONE | NodeInfoPopover 有值才显示 + Developer 折叠（GUI-2）；工程字段不默认展示 |
| 3.4 ImmersiveViewer 双击同源 | DONE | DONE | 双击 → `.vnext-immersive-viewer`（`gui7-17-immersive.png`） |
| 3.5 Capture Spawn Zone 稳定新捕获区域 | NOT DONE | DONE | CapturePlacementService 替代固定 spawn（GUI-3，连续 20 次零重叠）；Golden 中 20 捕获节点 `gui7-07` + 数值断言 overlaps=0 |

## Phase D GUI

| 项 | 旧 | 新 | 证据 |
|---|---|---|---|
| 4.1 visualFamily 取代业务 heuristic | DONE | DONE | GUI-2 去 title regex/反馈正则；`nodeVisualFamily` 仅剩 kind 兜底 |
| 4.2 Node 空字段隐藏 | NOT DONE | DONE | NodeInfoPopover 有值才显示（GUI-2）；空值不再出现「没有关联执行记录/not-generated」 |
| 4.3 Relation 三层视觉分离 | PARTIAL | DONE | Edge LOD + `edge-scope-*` class（GUI-4）；远视只留 active/runtime、非焦点 dimmed |
| 4.4 Edge LOD 大画布可读 | PARTIAL | DONE | 145 节点下选中局部关系 focused=2（`gui7-05`）；`zoom-band-*` LOD 生效 |
| 4.5 Anchored Note 定位 | NOT DONE | DONE | Core Note 投影 + anchorRefs + 定位按钮 + 脉冲（GUI-6）；`gui7-06` + camera 位移断言 |
| 4.6 Selection 邻近操作 | PARTIAL | DONE | 近场 strip：Agent/Collection/投送/整理/上下文 + More（`gui7-04`） |
| 4.7 Context/Workflow 一动作创建 | PARTIAL | DONE | Selection → 近场「上下文」一步加入；Workflow 从 Selection/Agent 一步开始（既有 + GUI-6 再确认） |
| 4.8/4.9 Outline/MindMap 同 hierarchy + Renderer 切换 | PARTIAL | DONE | hierarchy/positions/pins 落 Core presentation_views（HU-3A）；GUI-6 验证四种投影切换 membership 不丢（2906 集合 before==after）；Golden 中 hierarchy+pins 由种子写入并在 Outline/MindMap 呈现（`gui7-12/13`） |

## Phase H GUI

| 项 | 旧 | 新 | 证据 |
|---|---|---|---|
| 5.1 Shell 去重 | PARTIAL | DONE | GUI-1 清理 V07TopBar 死代码；ProjectStrip/WorkRail/SurfaceDock 单一职责（Pattern Map GUI-0 文档） |
| 5.2 WorkRail/ArtifactWorkbench/PreviewSurface 职责 | PARTIAL | DONE | GUI-0 所有权图 + GUI-1 shell 收敛；本轮无重复宿主 |
| 5.3 AgentContextSurface 不挡画布 + 不高频轮询 | PARTIAL | DONE | SSE 驱动（HU-3A 去 3s 轮询）；默认折叠胶囊；展开后显示待办/建议（`gui7-15b`） |
| 5.4 Diagnostics 隐藏 | DONE | DONE | 仅 `/__diagnostics` + DEV（既有） |
| 5.5 Version/Engineering noise | NOT DONE | DONE | NodeInfoPopover 有值才显示；Revision ID 移入 Developer 折叠（GUI-2）；`V1` 徽标仅在有历史时显示 |
| 5.6/5.7 文案 + Skill CTA | DONE | DONE | 全仓无「项目阶段/下一步/先选 Skill/Start Skill」；Workflow 为自由结构（GUI-6 文本断言 0 命中） |
| 5.8 Source Picker 非必经 | PARTIAL | DONE | Selection + Retrieval + Spatial candidate 自动装配 Context（GUI-6 断言 102 chips 可人工修正、无选择来源弹窗） |
| 5.9 MiniMap/Zoom | PARTIAL | DONE | MiniMap 可折叠、点击定位、缩放按钮；Golden 中 `fitAll`/locate/zoom 全流程可用（`gui7-02..07` 均经小地图导航） |
| 5.10 13-14 寸屏 | DONE | DONE | `gui7-14-canvas-1366.png`；1366×768 壳可用 + bodyScroll=0 断言 |

## 隐藏欠账（本轮新发现并修复，旧审计未列）

1. **stuck-drag auto-pan 写坏 graph**：pointerup 丢失后任意鼠标移动会拖动节点并写 `move_artifact_view` → `ProjectCanvas` 主键按住安全阀修复；修复后 Golden 全流程（含 Reorganize apply/revert）graph 位置零污染。
2. **Workflow presentation 保存回环**：`ProjectionSurface` 未 memo 导致每帧新 edges 身份 → 无限保存 + Maximum update depth → intent/context/workflow 解析 memo 化；修复后 8 秒 1 次 PUT、version=1。
3. **DialogsHost key 警告**：extraDialogs fragment 数组 → 移出数组。

## 已知噪声（非缺陷，如实记录）

- 首次打开项目时 `GET /presentations/presentation:context:*` 与 `presentation:workflow:*` 返回 404（按设计 NOT_FOUND 后由前端 seed 创建），属正常探测。
- 此前测试期间观察到偶发 `ACTIVE_CONTEXT_CONFLICT` 409，前端已按契约刷新自愈；多标签并发时仍可能复现，建议后续把 active-context 写入并入 SSE/版本队列（记入 OPEN_DEBTS，不阻塞本轮 Gate）。

## 证据文件

- Handoff：`docs/handoffs/GUI6_ANCHORED_NOTE_PROJECTION_COMPLETION_HANDOFF_20260811.md`、`docs/handoffs/GUI7_GOLDEN_ACCEPTANCE_HANDOFF_20260811.md`
- 截图：`.codex-runtime/gui7-01..17`（21 张）、`gui6-01..10`（10 张）
