# B3R3 Scene Creation Semantic Fix 交接（2026-08-14）

## 1. Changed

- `apps/web/src/App.tsx`：Workspace `+` 直接创建自动命名的 Empty Scene；继承 Camera、0 members、立即激活并进入 Arrange。
- `apps/web/src/features/workspace/WorkspaceDialog.tsx`：收敛为 edit-only。
- `scripts/validate-r31a5-static.mjs`：A5 合同更新为 Scene 新语义，并同步 A6 Search/Focus 分流。
- `apps/web/tests/sceneCreationSemanticContract.test.ts`：新增静态语义合同。
- `tests/e2e/scene-creation-semantic.spec.ts`：新增真实 GUI 创建、返回 Overview、刷新恢复测试。
- `apps/web/tests/freedomCapabilityContract.test.ts`：移除旧 seed-mode 断言。

## 2. Removed legacy behavior

- `WorkspaceSeedMode`：已删除。
- Selection / Scene / Empty create choices：已删除。
- create-mode WorkspaceDialog：已删除。

## 3. Preserved behavior

- Active Workspace = Current Scene。
- Context History 继续创建真实 Workspace Scene。
- `temporary-workbench` 只保留历史读取兼容。
- Active Workspace 不显示自己的 Workspace Frame。
- Grid、Freeform、Region、Context、Workflow、DotGlyph、Drop 与 Relation 行为未修改。

## 4. Verification

- `npm run check:r31a4-static`：13/13 PASS。
- `npm run check:r31a5-static`：13/13 PASS。
- `npm run check:r31a6-static`：10/10 PASS。
- `npm run check:r31b3-static`：17/17 PASS。
- Web unit：94 files，436/436 PASS。
- `npx playwright test tests/e2e/scene-creation-semantic.spec.ts --reporter=list`：1/1 PASS。
- Web lint：PASS，无新增 error；仓库既有 warnings 保留。
- Web typecheck：PASS。
- Web production build：PASS。
- `git diff --check`：PASS。
- Refresh persistence：GUI E2E 已验证新 Scene 仍存在、0 members、Camera 未重置。

## 5. Remaining debt

- Selection Semantic Drop → Workspace Rail 空白区域 → New Scene 属于后续 B slice，不是本轮缺陷。
- 当前未 Commit/Push。

## 回滚

逐文件反向恢复 `createEmptyWorkspaceScene`、WorkspaceDialog 与对应测试；不得使用 `reset --hard`，不得覆盖当前工作树中其他 A4–B3-r2 改动。
