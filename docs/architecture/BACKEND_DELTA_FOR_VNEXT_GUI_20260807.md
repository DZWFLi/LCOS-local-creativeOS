# Backend Delta for vNext GUI — N0 Contract Audit（2026-08-07）

基线：`mvp-fast-build` worktree，HEAD `c4b2d3b`（`codex/backend-hardening-20260802`）

依据：`给Codex_LCOS_20260806全栈与20260807前端重构合并说明_后端缺口_20260807.md` 第 6 节 GAP B1–B9。

结论速览：

| GAP | 判定 | 一句话 |
| --- | --- | --- |
| B1 Workspace Frame Bounds | **DONE（2026-08-07）** | frameBounds/preferredSurface/version 已持久化 + CAS + 前端拖拽/缩放/刷新恢复 |
| B2 Aggregate Relation Endpoint | **DONE（2026-08-07）** | RelationEntityType 扩展 view/workspace 端点 + 持久化测试 |
| B3 Projection Layout Store | FRONTEND_ONLY | 各投影独立布局属视图状态，不进后端 Canonical Truth |
| B4 Workbench Branch/Merge | **DONE（2026-08-07）** | WorkbenchService.merge Core 收口 + POST /projects/:id/workbench/merge + 前端 runtime 分支 |
| B5 ContextSnapshot History | **DONE（2026-08-07）** | ContextSnapshotService create/compare/branch + 路由 |
| B6 Session/Handoff 终局合同 | **DONE（2026-08-07）** | HandoffRecord + 三态 resumeMode + 路由（schema v20） |
| B7 ActiveContext 多 Agent 隔离 | **DONE（2026-08-07）** | sessionId 归因加入 ActiveContextInput/投影/路由 |
| B8 Run Proposal/Composer 对齐 | EXISTS | runtime-proposal-service.proposeRun 是唯一推断入口 |
| B9 UI Agent Core Command Surface | **DONE（2026-08-07）** | ScopeKind + temporary-workbench，workbench 创建走新 kind |

---

## B1 — Workspace 独立 Frame Bounds 持久化：EXTEND

> 状态更新（2026-08-07）：**已完成**。schema v19 迁移、`update_workspace_frame` mutation（CAS + version 递增、不 bump semantic graphVersion）、前端拖拽/缩放回写与刷新恢复已实现并通过真实浏览器验证。

已存在：

- `packages/domain/src/index.ts:74-80` `WorkspaceViewport { x, y, zoom }`
- `packages/domain/src/index.ts:82-96` `Workspace { viewport, focusedViewIds, visibleLayers, contextPolicy }`
- `apps/local-core/src/metadata-repository.ts:212-219` workspaces 表：`viewport TEXT`、`focused_node_ids`、`visible_layers`、`context_policy` —— 刷新/重启可恢复
- `apps/local-core/src/routes/canvas.ts:219` ActiveContext 更新允许 `viewport` + `expectedVersion` + `updatedBy`（CAS 与 actor 面已存在）

缺失：

- `frameBounds { x, y, width, height }`（独立于成员节点推导的空间框）
- `preferredSurface`（GUI 记忆用户偏好视图）
- Workspace 记录级 stale-write version guard（ActiveContext 有 CAS，workspace 表更新无 version）

建议 N1：workspaces 表加 `frame_bounds TEXT`、`preferred_surface TEXT`、`version INTEGER`；`Workspace` 域类型同步扩展；更新走 CAS。

## B2 — Workspace 聚合 Relation 端点：EXTEND

已存在：

- `packages/domain/src/index.ts:147-152` `RelationEntityType = 'artifact' | 'note' | 'scope'`
- `apps/local-core/src/metadata-repository.ts:226-231` relations 表 `source_entity_type/source_entity_id/target_entity_type/target_entity_id`

缺失：

- `RelationEndpoint = { kind: 'view'; viewId } | { kind: 'workspace'; workspaceId }` —— 目前端点不能指向 workspace/view
- Context Compiler 的 Workspace Context Policy（focused/visible/pinned/anchors）展开规则需要冻结

建议 N1：domain 扩展 RelationEndpoint 联合类型 + 校验；workspace 聚合关系先由前端 view 级边表达，domain 合同随后补。

## B3 — Projection Layout Store：FRONTEND_ONLY

后端无对应物，也不需要：

- Arrange 自由坐标 = ArtifactView.position/size（已持久化）
- Outline/Flow/Tree/Graph/Work/Deliver 的布局偏好 = GUI 视图状态，存 localStorage 即可
- 切换投影不得写回 Arrange 坐标；显式 Apply Layout 才写回（已有 `applyScopeLayout` / `proposeScopeLayout`）

建议：前端 `state/projectionPreferences.ts`（localStorage，可丢失 UI 偏好，符合 AGENTS.md 存储规则）。

## B4 — Workbench Branch/Merge Contract：EXTEND

已存在：

- `packages/domain/src/index.ts:57-67` `ScopeKind = 'root' | 'collection' | 'context' | 'delivery'` —— donor/前端用 `collection` 表达临时工作现场
- 前端 donor `projectViewsIntoScope`：同一 Canonical Object + Workbench Scope 下新 View Reference（不复制 Artifact）
- 前端 donor `mergeWorkbenchViews`：只并 stable（current/decision/note/context），保留 Run/历史，清空临时 views

缺失：

- `ScopeKind` 无 `temporary-workbench` 语义（可选：加 kind，或沿用 collection + flag）
- Core Application Service 原子收口 merge（当前是前端 setGraph 一次性提交，可接受但无领域规则）

建议 N1（前端先行，P1 Core 收口）：domain 加 `temporary-workbench` 或 `workbenchOf` 标记；merge 服务后续在 runtime-application-service 收口。

## B5 — ContextSnapshot / ContextCollection History：EXTEND

已存在：

- `packages/contracts/src/index.ts:143-158` `ContextManifestV0`（Run 冻结执行输入）
- `packages/domain/src/index.ts:211-219` `Checkpoint`（不可变快照，snapshotJson + workspaceId，可回看）
- `apps/local-core/src/routes/workspace-states.ts` 工作现场历史

缺失：

- ContextSnapshot 的"版本串珠"（beads）、与当前对比（compare）、从 Snapshot 分支 Workbench、追溯 source Run/Session

建议 N2：以 Checkpoint 为底座扩展 ContextSnapshot 投影 API（compare/branch/source 归因），不加第二套表。

## B6 — Session / Handoff 终局合同：EXTEND

已存在：

- `packages/domain/src/index.ts:221-230` `SessionSummary { title, summary, runIds, handoffRef }`
- `apps/local-core/src/routes/workspace-states.ts` + metadata-repository 有 handoff 相关写入
- 前端 `features/handoff/HandoffDialog.tsx`（生成 Handoff Markdown）

缺失/待确认：

- 持久 Handoff 记录实体（Decision / OpenQuestion / NextAction 投影）
- Provider-neutral Handoff Package 合同（ContextManifest ref + summary + decisions + refs + next action）
- Native Resume / Standard Handoff / Session Shadow 三态语义

建议 N3：先补 Handoff 持久记录 + 投影；三态语义进合同文档。

## B7 — ActiveContext 多 Agent 会话隔离：EXISTS（+小扩展）

已存在：

- `apps/local-core/src/active-context-store.ts:5-15` `ActiveContextInput { expectedVersion?, updatedBy?, ... }`
- `apps/local-core/src/active-context-store.ts:46-48` `ActiveContextConflictError`（STALE 冲突）
- `apps/local-core/src/active-context-store.ts:117-118` `expectedVersion !== previous.version` → 抛冲突
- `apps/local-core/src/routes/context-proposals.ts:80-119` 提案 accept 带 `expectedVersion: current.version`

小扩展（P0 审计后可选）：

- `updatedBy` 目前是自由字符串，建议规范为 `{ actor: 'user'|'gui'|'agent:<sessionId>' }` 归因，便于多 Agent 会话审计

## B8 — Run Proposal / Composer Contract 对齐：EXISTS

已存在：

- `apps/local-core/src/runtime-proposal-service.ts:9-59` `inferIntent` + `proposeRun`（Target inference / intent / guard）
- `apps/local-core/src/runtime-proposal-service.ts:124` guarded 调用链
- 前端 Composer 只暴露 Operation/Agent/Result 三语义（donor `SurfaceComposerBar`），内部 ID 不暴露

结论：UI 薄调用现状正确，不需要重做；N5 时确认 MCP 不复制推断规则。

## B9 — UI Agent 操作的 Core Command Surface：EXTEND

已存在：

- 37 个 Agent MCP 工具（8/6 瘦身），用户语义级动作（propose/focus/run/review）
- `packages/domain/src/index.ts:57-67` Scope 类型

缺失：

- `ScopeKind` 无 temporary-workbench（同 B4）
- 布局类动作（move/viewport/auto-arrange/projection coords）已明确不进默认 Agent MCP schema（合并说明第 6 节 B9）

建议：与 MCP 最终瘦身（N5）一起处理；本轮不扩 MCP。

---

## N1 前端阻塞项（本轮 GUI 接线必须）

1. Workspace frameBounds + preferredSurface 持久化（B1）——GUI 的 Frame 拖拽/缩放/刷新恢复
2. ActiveContext 继续用现有 CAS 合同（B7），不重开第三套 Context Truth
3. Workbench 用 collection scope + view ref（B4 前端先行），Core merge 服务 P1

## 不重做清单（合并说明第 5 节逐项核对）

| 能力 | 现状 |
| --- | --- |
| Canonical Run / RuntimeDispatch / ArtifactReturn / Draft Revision / Accept-Reject-Retry | EXISTS（runtime 全链路，Gate F 已验） |
| Cancel + Late Result Guard / Task Lease / Heartbeat | EXISTS |
| ActiveContextV2 基础 / Canvas Snapshot | EXISTS（active-context-store + canvas.ts SSE） |
| Conversation import L0 / Timeline / Outline / FTS | EXISTS（conversation-import-service） |
| Resource Import / Preview Registry / File states | EXISTS |
| Agent MCP / Executor MCP 角色分离 | EXISTS（8/6 已瘦身 45→37） |
| Runtime Host / Provider Session Binding | EXISTS |

结论：**没有一项需要重做**；本轮全部是扩展或前端接线。
