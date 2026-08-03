# 前端 × 新后端 配合指南（2026-08-03）

> 基线：`codex/backend-hardening-20260802 @ b1e6fcf` ｜ 全部方法已在 `apps/web/src/runtime/localCoreClient.ts` 提供
> 规则：前端禁止复制领域类型，一律从 `@local-creative-os/contracts` 引类型；禁止用 localStorage 存 Membership/Run 真相。

## 1. 接口 ↔ 前端方法映射

| 功能 | HTTP | web client 方法 | 谁消费 |
|---|---|---|---|
| 目录选择（原生弹窗，中文路径已修） | POST /system/select-directory | selectDirectory | 项目创建/打开 |
| 项目打开（自动命名+导入） | POST /projects | createProject({intent:'open'}) | 项目对话框 |
| 当前选择真相 | GET/PUT /projects/:id/active-context | updateActiveContext / 新增 target 字段 | Canvas 选择同步 |
| 执行提案（一行摘要+歧义问） | POST /projects/:id/runs/propose | proposeRun | Context Composer |
| 发送 Run（显式 intent） | POST /projects/:id/runs | createRuntimeRun（outputIntent 必填，可带 resultPolicy） | Composer 发送 |
| Provider 发送前状态 | GET /runtime/providers | runtimeProviders | 三级选项 Agent 选择 |
| Workspace 成员增删查移 | POST/DELETE /workspaces/:id/members… | addWorkspaceMembers / removeWorkspaceMember / moveWorkspaceMember / workspaceMemberships | 选择态快捷动作、Dock/Frame 拖放 |
| 保存现场/里程碑 | POST/GET /workspaces/:id/states | saveWorkspaceState / listWorkspaceStates | 右栏/顶部动作 |
| 恢复现场 | POST /workspaces/:id/states/:id/restore | restoreWorkspaceState | 现场列表 |
| 版本溯源 | GET /artifacts/:id | artifactDetail | Workbench Revision 页 |
| 版本列表/对比 | GET /artifacts/:id/revisions、/projects/:id/revisions/compare | revisionList / revisionCompare | Workbench Compare |
| 过程投影 | GET /projects/:id/process-projection | processProjection | Canvas 过程层/右栏 Activity |
| 会话摘要/Handoff | POST/GET /projects/:id/session-summaries | createSessionSummary / listSessionSummaries | 右栏全局对话/交接 |
| 内容搜索 | GET /projects/:id/artifacts/search?q= | artifactSearch | Composer ＋ Picker |
| 只读预览 | GET /projects/:id/file-records/:id/content | （现有 previewContent 体系） | ArtifactViewerHost |

## 2. Phase 2 Composer 落地要点

- 选择变化 → `updateActiveContext`（150ms debounce 已有）→ 读回 `selectedViewIds` 作为 Shelf 默认 Context；
- 用户增删 Shelf → 维护 `pinnedContextIds`（PUT active-context），**Shelf 未显示的不得进 contextItems**；
- Edit Target → `targetArtifactId + targetRevisionId`（PUT active-context），必须绑定 Base Revision；
- 发送前调 `proposeRun` 显示 `summary`；`ambiguity` 存在时只问一个问题；用户确认后 `createRuntimeRun` 传 `proposal.intent / contextItems→contextArtifactIds / editTargets→targetArtifactId / resultPolicy / requestedProvider`；
- Provider 选择：`runtimeProviders` 返回 `manual/offline` 时不可显示 Ready；Offline 禁止发送；
- 发送后不再弹 RunConfirmDialog；右栏自动切 Run 状态（`getRunReview` + `syncRuntimeRun` 轮询或等 AutoSync）。

## 3. Workspace 快捷动作

- 多选 → `addWorkspaceMembers(workspaceId, viewIds)`；移出 → `removeWorkspaceMember`；移动 → `moveWorkspaceMember`；
- 拖入 Frame/Dock → 同 add；拖出询问“仅移动位置 / 移出成员”；
- 节点归属一律显示为 Membership 派生值，不写 localStorage；
- 删除 Workspace 不删内容（后端已保证）。

## 4. Workbench 落地要点

- 双击文件 → 打开 Workbench preview（`ArtifactViewerHost` 已统一）；
- Revision 页 → `artifactDetail` 展示溯源（Run/Prompt/Provider/时间）；
- Compare → `revisionCompare`（文本行级 diff / 非文本元数据）；
- “基于此版本继续” → 只允许发起 revise（后端 Guard 拒绝外部 Reference 与 create 带目标）。

## 5. 后端新增约束（前端必须感知）

1. `outputIntent` 必填；analyze/create 带 target 会被 400/409 拒绝；
2. 外部 Reference（`.link.md`）作 revise 目标会被拒绝；
3. `resultPolicy` 白名单：analyze∈{reply_only,create_artifact}；create∈{create_artifact,create_collection}；revise= draft_revision_per_target；
4. Membership 是唯一成员真相；`focusedViewIds` 只是焦点；
5. Provider 未证明零点击前显示 manual；Bridge 离线显示 offline；
6. waiting_input 协议未开放（阻塞项），前端不要做假 waiting_input 交互。

## 6. 验收口径

“接口/类型/按钮存在”不算完成；每个 Composer/Workbench/Workspace 动作需：GUI 可操作 → 真实持久化 → CLI/MCP 等价 → 刷新/重启恢复 → 截图证据。
