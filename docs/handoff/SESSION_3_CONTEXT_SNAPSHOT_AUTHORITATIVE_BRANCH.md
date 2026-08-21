# Session 3 Handoff｜Context Snapshot Branch 收成 Core 单一路径

## Goal

冻结「Context History Branch → Core authoritative branch」：GUI 不再在前端手工重建 Workspace，与 CLI / Agent 共享同一 branch 语义。

## Baseline

- branch: `codex/r1-vision-merge-20260812`
- HEAD（实施前）: `7121356`
- dirty files before: 无
- dirty files after: 本 Session 的代码 + 测试 + 本文档

## Authoritative path after this session

```text
Context History rail「从这里分支」
→ POST /projects/:id/context-snapshots/:snapshotId/branch（Core branchContextSnapshot）
→ Core：新建 collection scope + 从快照 refs 复制视图（不修改原快照 / 原 Context）
→ Web loadProject() 回读 → 定位 collection scope / 选中新视图 / 适配相机
```

已删除的本地真相源：`branchContextHistoryToWorkbench` 原来的 `createWorkspaceRecord` + `semanticRefsForSourceIds` + `appendExactPresentationEntityRefs` 前端重建（工作场景引用 + Presentation 成员）整体移除。

## Files changed

- `apps/web/src/App.tsx`：branch 处理器改为 Core 调用 + reload 定位；注释同步新语义
- `apps/web/src/features/surfaces/ContextHistoryRail.tsx`：按钮文案「从这里建现场」→「从这里分支」
- `apps/web/tests/contextSnapshotBranch.test.ts`：新增源契约 2 用例
- `apps/web/tests/sceneCreationSemanticContract.test.ts`：旧「建现场重建」断言对齐 Core 分支契约
- `tests/e2e/context-snapshot-branch.spec.ts`：新增真机 E2E 1 用例

## Tests actually run

| command | result |
|---|---|
| `npm run typecheck`（4 包） | PASS |
| `vitest contextSnapshotBranch.test.ts` | 2/2 PASS |
| `npm run test --workspace web` | 101 文件 / 462 用例 PASS |
| `vitest context-snapshot-service.test.ts`（Core B5） | 1/1 PASS |
| `npm run build` | PASS |
| `npx playwright test tests/e2e/context-snapshot-branch.spec.ts` | 1/1 PASS |
| `npm run test:e2e`（全量） | 20/20 PASS |

## Manual smoke actually run

真机浏览器：种 Context graph → API 创建快照（workspace-brief-script）→ Context 详情历史栏点「S3 快照」→「从这里分支」→ 自动定位到新建 collection（≥2 复制视图 + 提示「分支为工作集合」）→ reload 后 Project rail 出现「从 S3 快照 恢复」视图。

Core truth 断言：原快照仍在、原视图 `view-brief` 仍属原 scope、新 collection 有 ≥2 个复制视图。

## Acceptance checklist

- [x] GUI 改为调用 Core `branchContextSnapshot`
- [x] App.tsx 本地 branch reconstruction 已删除
- [x] branch 后 Workspace / member refs / provenance / relation 由 Core 决定
- [x] 无 schema 新增 / 迁移（Core branch 已能表达分支语义）
- [x] snapshot create / compare / branch（Core B5 测试 + 真机分支）
- [x] branch 后 reload 持久（Core truth，Project rail 可见）
- [x] branch 不修改原 snapshot / 原 Context（graph 断言）
- [x] 不再有两个 branch truth source

## Remaining debt discovered in this Session

1. CLI 无 snapshot branch 命令（GUI/Agent 共享 Core 端点；CLI 缺口归 S9 接口收口时统一决定）。
2. 分支按钮原语义是「建现场」，现改为 Core 的「collection 分支」；若产品要保留「从历史恢复成 Workspace」的旧语义，需要另定 Core Workspace-restore 端点（超出本 Session 单一路径原则，未擅自扩展）。

## Explicitly not done

- 未新增 Core Workspace-restore 语义（旧「建现场」行为被 Core 分支语义替代）；
- 未进 Session 4。

## Risk / rollback point

- 回滚点：`7121356`。行为变化：历史分支从「工作现场引用」变为「collection + 复制视图」，属计划授权的单一路径收口。

## Verdict

**PASS**
