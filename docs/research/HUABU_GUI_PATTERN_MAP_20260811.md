# HUABU GUI Pattern Map + LCOS Ownership Map（GUI-0）

> GUI Closeout II 的只读前置切片。Huabu 固定 SHA：
> `2d3618b559576cbdd0fe2a58a7b200a84a6f4d09`
> （见 `docs/provenance/HUABU_AUDIT_SOURCE_SHA.txt`）

## 1. Pattern Map

| Huabu Source | Pattern | LCOS Current | Decision | LCOS Target |
|---|---|---|---|---|
| `store/gesturePreviewStore.ts` | purely visual / never persisted / never undone 的 transient 手势层 | HU-3A 已落地 `GesturePreviewStore`（dragPositions/layoutGhost/dropTarget/guides） | ADOPT（已实施） | GUI-5 Ghost 层消费 layoutGhost；不新增第三套 preview state |
| `components/Nodes/NodeWrapper.tsx` | 共享 Node Chrome：OverlayPortal（屏幕空间、interaction priority 0–3）、selection chrome、resize+snap、LOD、takeover 连续缩放态、provenance 徽标 | `CanvasNodeVisual` 巨大 switch + `SurfaceObject`；无统一 overlay 优先级模型 | ADAPT | `CanvasNodeShell`：SelectionChrome + NodeContentRenderer（按 MIME/kind/conversation/run 注册）+ TransientAffordances；禁 feedback/decision 业务正则驱动长相 |
| `components/Common/FloatingToolbar.tsx` | 复合工具条（Action/Group/Divider/Select/Size/Align），popover 外部点击/Escape 关闭且不清 selection | `SelectionComposer` 只偏 Agent，缺 Create Context / Relate / Reorganize | ADAPT | 两层：Primary strip（Ask Agent / 整理 / 建立关系 / 放入上下文）+ More；默认收起 |
| `components/Nodes/previews.ts` | 机械 NodePreviews 注册表（note/web/pdf/office/image/video/sketch）——内容类型驱动，无业务 kind | `visualFamilyFor()/nodeVisualFamily()` 仍含 `kind===process`、feedback/反馈/change/keep、skill.md、URL title regex | ADAPT | 只按 MIME / resource kind / file record / artifact source / conversation mapping / run role 渲染；`business semantic != visual family` |
| `config/semanticZoom.ts` + `useNodeLOD` | 按屏幕宽度连续降级（非离散 stage swap），takeover 徽标随宽度形变 | LOD 有 `full/simplified/overview`，节点降级缺连续 morph | ADAPT（P1 性能阶段） | 节点内容优先，缩放降级顺序已写进 AGENTS.md；takeover morph 放 Phase I |
| `hooks/useFrameDragToCreate.ts` + `FrameNode` | Frame 结构化分组 + 拖拽创建 | LCOS hierarchy（Presentation parent/order） | REJECT（DOMAIN） | Frame 不进领域模型；只保留 presentation primitive（已定） |
| XYFlow edges（engine 层） | 边交互/嵌套 | `SpatialEdgeLayer` 只是 SVG wrapper | KEEP LCOS FOUNDATION | 借交互策略不借引擎；GUI-4 做 Domain/Presentation/Runtime 三层显示 + Edge LOD |
| `Panels/Canvas/SelectionOutlines.tsx` | 多选边界框统一 chrome，单选让位节点自身 resize/toolbar | 多选无统一 selection outline | ADAPT | 多选 bounding chrome；单选 near-field 工具条 |
| `NodeConnectAffordance.tsx` | 节点连接柄（selection 附近出现） | 画布有 edge 拖拽但节点柄弱 | ADAPT | GUI-4 ConnectedNodePicker / NodeConnectAffordance |

## 2. LCOS GUI Current Ownership Map

| Owner | Current Location | 结论 |
|---|---|---|
| Project / Navigation | `ProjectStripVNext` + `V07TopBar`（App.tsx 装配） | 重复 owner，需合并/删除其一；Project Home 保持 launcher 语义（GUI-1） |
| Workspace / Rail | `WorkRail` + `SurfaceDock` 空间轴 | 保留单一 owner：rail 只管本地导航/工作区 |
| Selection | `SelectionComposer`（Agent 偏置）+ `selectNode` | 扩为 near-field（GUI-4）；保持“第一次单击只选中”已实现 |
| Node renderer | `CanvasNodeVisual` + `SurfaceObject` + `visualFamily` | 拆机械注册表（GUI-2） |
| Preview | `PreviewCacheService` + `ResourceDetailDialog` + `CanvasNodeVisual` 缩略图 | 自动 async + fallback，去掉“生成预览”按钮与工程噪音（GUI-2） |
| Presentation | `PresentationViewSessionCore` + `presentationDraft/hierarchy`（HU-3A 已收口） | 唯一 committed truth；ghost 走 GesturePreviewStore（GUI-5） |
| Run / Agent | `WorkSurface` + `AgentContextSurface` + SSE（3s 轮询已确认只在断流回退） | 事件驱动；普通状态 pill/badge，working/blocked 才展开（GUI-1） |
| Capture | `CaptureApplicationService` + 固定 spawn `{480,240}` | 删除固定像素；Presentation membership + placement intent（GUI-3） |
| Immersive Viewer | `ImmersiveNodeView` / 详情 Overlay | 全屏内容优先（GUI-2 §5） |

## 3. 明确不重做

- 不换 Canvas Engine（SpatialCanvas/SpatialViewport/Layers/ELK/fCoSE 保留）
- 不引入 FrameEntity
- 不做 Before/After 双画布（Ghost 用 fade + overlay + change summary）

## 4. GUI II 阶段排序（后续 Session）

GUI-1 Shell/Project → GUI-2 Node Content + Preview Detox → GUI-3 Capture Landing →
GUI-4 Selection/Relation/Anchored Note → GUI-5 Reorganize Ghost + Change Review →
GUI-6 Projection/Context/Workflow → GUI-7 Golden Acceptance（1366×768 硬 gate，
15 张截图矩阵）。

> 本文件为 GUI-0 只读交付；GUI-1..7 尚未实施（见 Handoff 状态）。
