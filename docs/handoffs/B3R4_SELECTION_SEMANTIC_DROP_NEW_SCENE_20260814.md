# B3R4 Selection Semantic Drop → New Scene 交接（2026-08-14）

## 1. Changed

- `apps/web/src/App.tsx`：复用 `buildWorkspaceScene` factory；新增 `createWorkspaceSceneFromDropPayload` 原子提交路径。
- `apps/web/src/features/spatial/semanticRightDrop.ts`：新增 `workspace:new-scene` destination，并补 Escape 清理。
- `apps/web/src/features/shell/WorkspaceRailVNext.tsx`：Rail 末端增加仅在合法 drag-over 时显形的 `+ 新 Scene` target；现有 Workspace item target 保持不变。
- `apps/web/src/reconstruction.css`：新增轻量、非驻留式 target 反馈。
- `apps/web/tests/newSceneSemanticDropContract.test.ts`、`scripts/validate-r31b3r4-static.mjs`：新增 B3R4 contracts。
- `tests/e2e/new-scene-semantic-drop.spec.ts`：覆盖 3 项创建、payload 冻结、Escape cancel、连续独立创建与刷新恢复。

## 2. Final interaction

```text
Workspace +
→ Empty Scene

Selection
→ Semantic Right Drag
→ Workspace Rail Empty Area
→ + 新 Scene
→ New Scene with payload membership
```

Drop 成功后不弹 Dialog、不二次确认；Scene 自动命名、继承 Camera、立即激活并进入 Arrange。

## 3. Membership source

Membership 严格来自 drag start 时冻结的 `sourceIds`。Commit 不读取实时 `selectedIds`；经 `semanticRefsForSourceIds` 转换为稳定 view ids / EntityRefs，保持顺序去重，空或无效 payload 直接拒绝。

## 4. Preserved behavior

- Workspace `+` = Empty Scene，0 members。
- Active Workspace = Current Scene；active Scene 不显示 self frame。
- WorkspaceDialog 继续 edit-only，无 `WorkspaceSeedMode`。
- Context History 继续创建 real Scene。
- `temporary-workbench` 只保留 legacy read compatibility。
- Existing Workspace item drop 未修改。
- Grid / Freeform / Region / Context / Workflow / Search / Focus 等 B3 其它能力未修改。

## 5. Verification

- A4：13/13 PASS。
- A5：13/13 PASS（合同定位同步到共享 Scene factory）。
- A6：10/10 PASS。
- B3：17/17 PASS。
- B3R4：10/10 PASS。
- Web unit：95 files，441/441 PASS。
- GUI E2E：2/2 PASS；新用例真实验证 payload freeze、cancel、连续创建、Refresh persistence。
- Web lint：PASS，无 error；既有 warnings 保留。
- Web typecheck、production build、smoke：PASS。
- In-app browser：页面非空、无框架 overlay、0 console warning/error；目标 DOM 唯一存在且平时保持透明。
- `git diff --check`：PASS（仅既有 CRLF 提示）。
- 证据：`tests/e2e/new-scene-semantic-drop.spec.ts`、`apps/web/tests/newSceneSemanticDropContract.test.ts`。

## 6. Remaining debt

- 无 B3R4 阻塞项。
- 当前变更仍在 A4–B3 集成工作树中，未 Commit / Push。

## 回滚

反向恢复上述 B3R4 destination、Rail target、Scene drop commit、CSS 和测试即可；不得使用 `reset --hard`，不得覆盖同工作树其他 A4–B3 变更。
