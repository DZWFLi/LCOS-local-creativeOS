# Phase 1 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2_REFERENCES_CODE_GATES_20260812.md` §4 Phase 1。
> 日期：2026-08-12

## Status
COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Acceptance Evidence

### Item 1 — Global Agent card removed from normal shell
Requirement: 正常 Shell 不出现 Global Agent 大卡片。

Code:
- `apps/web/src/features/shell/AgentContextSurface.tsx`：仅 `agentMode`（URL `?agent=codex`）渲染；默认折叠为小胶囊。
- `apps/web/src/App.tsx`：`agentSurface` 只在 `agentMode` 时注入（`App.tsx:3672`）。

Browser evidence: 正常模式（无 `?agent`）页面无 `.agent-context-surface` / `.agent-context-surface-collapsed`。
Result: DONE

### Item 2 — no main-canvas receiver pill
Requirement: 主画布/顶栏不再有「收件 →」捕获接收 pill。

Code:
- `apps/web/src/features/shell/ProjectStripVNext.tsx`：移除 `captureTarget` prop、`vnext-capture-target` 按钮与 `Inbox` 入口。
- `apps/web/src/App.tsx`：移除 `pinCaptureTarget` / `pinnedCaptureProjectId` / registry 同步 effect。
- Runtime Registry（`/runtime/registry/capture-target`）与 capture 亲和逻辑保留给 CLI / Phase 5 扩展使用。

Tests:
- `apps/web/tests/phase1RailContract.test.ts`：断言 strip 不含 `captureTarget` / `vnext-capture-target` / `收件`。
Browser evidence: headless 实测 `document.querySelector('.vnext-capture-target') === null`。
Result: DONE

### Item 3 — flat rail, no folders
Requirement: 左栏是扁平空间视图切换器，不是目录树。

Code:
- `apps/web/src/features/shell/WorkspaceRailVNext.tsx`：扁平栈（Main 固定 + 工作空间列表），无目录层级。
Tests: `phase1RailContract.test.ts`（`not.toContain('folder')`）。
Result: DONE

### Item 4 — Main fixed first
Requirement: 主画布固定第一位。

Code:
- `WorkspaceRailVNext.tsx`：`data-rail-kind="main"`，`aria-label="主画布"`，独立于可重排的工作空间栈。
Browser evidence: 渲染顺序 [主画布, workspace…]，主画布按钮不在可移动列表内。
Result: DONE

### Item 5 — saved views reorder persist after reload
Requirement: 保存视图顺序跨 reload / Core 重启保持。

Code:
- `packages/contracts/src/index.ts`：新增 `reorder_workspaces` MutationOperation。
- `apps/local-core/src/metadata-repository.ts`：迁移 33（`workspaces.sort_index` + 回填）；`get/getWorkspaces` 按 `sort_index,rowid` 排序；`applyMutations` 新增 `reorder_workspaces`（全量覆盖校验、事务内写索引）；`#upsertWorkspace` 新行自动追加到尾部；`schemaVersion` 33。
- `apps/web/src/runtime/runtimeBridge.ts`：`diffStateToOps` 在「同集合、仅顺序变化」时发射 `reorder_workspaces`；工作空间移除时发射 `delete_workspace`。

Tests:
- `apps/local-core/tests/metadata-repository.test.ts`：reorder 持久化 + 重开库顺序保持 + 非法子集拒绝；delete 清成员 + 重开保持。
- `apps/web/tests/runtimeBridge.test.ts`：diff 发射 reorder / delete。

Browser evidence:
- UI 菜单「上移」→ reload → 顺序保持。
- `restart-core.ps1` 重启 Core → reload → 顺序保持。
- 删除测试工作空间 → reload → 无幽灵项。
Result: DONE

### Item 6 — drag rail item into canvas works
Requirement: 从左栏拖视图到画布可完成投送，且不复制 Artifact。

Code:
- `WorkspaceRailVNext.tsx`：工作空间项 `draggable` + `application/x-lcos-workspace`。
- `apps/web/src/features/spatial/SpatialCanvas.tsx`：`onExternalDrop`（读自定义 MIME）。
- `apps/web/src/features/canvas/ProjectCanvas.tsx`：映射 frame → 成员 → 复用既有 `onStageTransfer`（DropShelf 只建引用，不复制内容）。

Tests: `phase1RailContract.test.ts`（rail draggable / spatial getData / canvas onWorkspaceDrop）。
Browser evidence: DnD 插桩确认 dragstart→dragover→drop 数据链路；带成员工作空间拖入画布弹出「投送 2 个对象」面板。
Result: DONE

### Item 7 — node `?` removed/replaced
Requirement: 节点问号信息入口移除或替换。

Code:
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`：`CircleHelp` → `Info`。
Tests: `v07Integration.test.ts`（`<Info` + 无 `CircleHelp`）；`phase1RailContract.test.ts`。
Result: DONE

## Failure injection

- Rail save failure：停 Core → 菜单上移 → UI 显示「保存失败」+ 明确提示，saveStatus=unsaved（不假装成功）→ 重启 Core → reload → 顺序回滚为持久化顺序。
Evidence: 上述浏览器实录。
Result: PASS

## Restart / reload evidence

- Browser reload：顺序保持。
- Core restart（`.codex-runtime/restart-core.ps1`，PID 15816）：顺序保持；删除保持。
- Project reopen：项目重载后顺序保持。
Result: PASS

## Browser evidence

- 1440×900 主界面截图：`docs/audit/phase1-shell-1440x900.png`
- 1366×768 主界面截图：`docs/audit/phase1-shell-1366x768.png`
- DropShelf 面板截图：`docs/audit/phase1-drop-shelf-1440x900.png`
- DnD 数据链路插桩日志：dragstart(rail) → dragover/drop(canvas, `application/x-lcos-workspace=ws-review-…`)

## Visual review
VISUAL ACCEPTANCE PENDING（模型无可靠视觉判断；截图供人工/视觉评审签字）

## Hidden-debt scan

关键词扫描（TODO/FIXME/temporary/fallback/mock/placeholder/partial/compat/not persisted 等）覆盖全部改动文件：
- 命中项均为既有合法用途（CSS `edge temporary`、图片 `fallback` 状态、`mockClient` 测试夹具、Core `fallbackProjectId` 参数、`sqlite-blob-fallback` 后端名、兼容导出注释），非本轮引入。

## Discovered Debt
无本轮新增。

## Remaining Debt
NONE
