# LCOS Phase 1 Handoff

## Status
COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Scope implemented

- 顶栏移除「收件 →」捕获接收 pill（Runtime Registry 与 CLI/扩展入口保留）。
- 左栏 = 扁平空间视图切换器：主画布固定首位 + 可重排工作空间（保存视图）。
- 工作空间排序 / 删除持久化：Core 迁移 33（`workspaces.sort_index`）、`reorder_workspaces` / `delete_workspace` mutation，Web diff 自动发射。
- 左栏工作空间可拖入画布，复用 DropShelf 投送（加入/移动/继续工作），不复制 Artifact。
- 节点 `?` 信息入口替换为中性 Info 图标。
- 正常 Shell 不再出现 Global Agent 大卡片（仅 agentMode 胶囊）。

## References studied
- 计划 §4（Phase 1 规格与验收）
- 现有实现：`ProjectStripVNext` / `WorkspaceRailVNext` / `SpatialCanvas` / `ProjectCanvas` / `runtimeBridge.diffStateToOps` / `metadata-repository.applyMutations`

## LCOS-native decisions

ADOPT:
- 排序/删除走既有 mutation 管道（diffStateToOps → applyMutations），不新增 Core 实体。
- Rail 拖入画布复用 DropShelf（参考引用语义），不复制内容。

ADAPT:
- 计划中的 `ProjectViewRailItem` DTO 不新建：现有 Workspace 记录即「保存视图」，Main 用固定入口表达。

KEEP LCOS:
- Capture 归属仍是 Core 唯一裁决（Extension/CLI 只发 capture，不做亲和）。
- Ghost 三态、Selection 不自动变 membership 的既有规则不变。

REJECT:
- 不为「视图切换」新增 Core 业务类型。

## Files changed

- `packages/contracts/src/index.ts`（MutationOperation 新增 reorder_workspaces）
- `apps/local-core/src/metadata-repository.ts`（迁移 33、排序/删除 op、查询排序、schemaVersion 33）
- `apps/web/src/runtime/runtimeBridge.ts`（diff 发射 reorder/delete）
- `apps/web/src/features/shell/ProjectStripVNext.tsx`（移除 capture pill）
- `apps/web/src/features/shell/WorkspaceRailVNext.tsx`（Main 固定 + draggable）
- `apps/web/src/features/spatial/SpatialCanvas.tsx`（onExternalDrop）
- `apps/web/src/features/canvas/ProjectCanvas.tsx`（workspace drop → DropShelf）
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`（CircleHelp → Info）
- `apps/web/src/App.tsx`（移除 pill wiring、接入 onWorkspaceDrop）
- 测试：`phase1RailContract.test.ts`（新增）、`runtimeBridge.test.ts`、`v07Integration.test.ts`、`metadata-repository.test.ts`、`runtime-persistence.test.ts`、`title-policy.test.ts`、`resource-analysis-persistence.test.ts`、`universal-resource-import.test.ts`

## Contract changes

- `MutationOperation` 增加 `reorder_workspaces { workspaceIds }`。
- 数据库 user_version 32 → 33（`workspaces.sort_index`）。

## State ownership

- Web：`workspaces[]` 数组顺序 = 视图切换器顺序（乐观），由 diff 同步到 Core。
- Core：`workspaces.sort_index` 唯一持久化顺序真相；删除清成员后删行。

## Persistence behavior

- 新建/改名/成员/排序/删除均通过增量 mutation 落库；reload 与 Core 重启后按 `sort_index` 恢复。

## Failure behavior

- 保存失败：saveStatus=unsaved + 「保存失败」提示，UI 不假装持久成功；重载回滚为持久化顺序。
- reorder 非法子集：Core 抛错，批次回滚。

## Restart evidence

- Browser reload、Core restart（restart-core.ps1）、Project reopen 均实测顺序/删除保持。

## Targeted tests

- core：`metadata-repository.test.ts`（reorder/delete/migration）、`runtime-persistence`、`title-policy`、`resource-*`（schemaVersion 33）
- web：`runtimeBridge.test.ts`（diff reorder/delete）、`phase1RailContract.test.ts`、`v07Integration.test.ts`

## Full relevant regression

- web 315/315、core 366/366、lint/typecheck/build 全绿。

## Browser flow tested

1. 主画布固定首位 + 2 个保存视图（可拖）
2. 菜单上移 → 保存 → reload → 顺序保持
3. Core 重启 → reload → 顺序保持
4. 新建带成员工作空间 → 拖入画布 → DropShelf「投送 2 个对象」
5. 删除该工作空间 → reload → 无幽灵项
6. 停 Core → 排序 → 「保存失败」→ 重启 Core → reload → 顺序回滚
7. 恢复原项目顺序

## Screenshots

- `docs/audit/phase1-shell-1440x900.png`
- `docs/audit/phase1-shell-1366x768.png`
- `docs/audit/phase1-drop-shelf-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫（见 `docs/audit/PHASE1_COMPLETION_AUDIT_20260812.md`），无本轮新增。

## Discovered Debt
无。

## Remaining Debt
NONE
