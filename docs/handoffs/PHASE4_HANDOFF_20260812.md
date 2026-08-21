# LCOS Phase 4 Handoff

## Status
FUNCTIONAL COMPLETE（代码/单测/持久化/HTTP 全通过；视觉验收 PENDING）

## Scope implemented

- Slice 1：Operator 模型（condition/parallel-split/parallel-join/reference，无 serial）、端口推导、条件分支编辑器、输出→输入端口连线、Run 投影、workflowOperators 持久化。
- Slice 2：右侧 workspace strip（重排持久化复用 Phase 1 mutation）、`.lcos-workflow.zip` 导出/导入（manifest/workflow/references，roundtrip + 失败路径）、前端导出/导入按钮。

## Files changed

- `packages/contracts/src/presentations.ts`（workflowOperators）
- `apps/local-core/src/workflow-export-service.ts`（新增）
- `apps/local-core/src/routes/workflow.ts`（新增）+ `server.ts` 注册
- `apps/web/src/features/workflow/workflowOperators.ts`（新增）
- `apps/web/src/state/presentationOperatorState.ts`（新增）
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`、`ProjectionSurfaces.tsx`、`App.tsx`
- `apps/web/src/runtime/localCoreClient.ts`（export/importWorkflow）
- `apps/web/src/reconstruction.css`
- 测试：`workflowOperators`（5）、`phase4Slice1Contract`（4）、`workflow-export-service`（3，含 4 失败路径）、`server`（unknown route 回归）

## Contract changes
- PresentationStateV0 可选 `workflowOperators`（Presentation-only）。
- 新增 HTTP：`/projects/:id/workflow/export`（GET zip）、`/projects/:id/workflow/import`（POST multipart）。

## State ownership
- Operator / workflow 成员 / 边：Core workflow presentation state（CAS + fail-closed）。
- Workspace 顺序：Core `workspaces.sort_index`（Phase 1 机制）。

## Persistence behavior
- reload 保持；导出内容由 presentation state 生成；导入 CAS 写入。

## Failure behavior
- 导入：未知 schema / 重复 workspace id / 缺失引用 / 非成员边 → 结构化拒绝，零部分写入。
- 保存失败：fail-closed。

## Restart evidence
- Core restart 后导出端点可用（HTTP 200）。

## Targeted tests
- 见各 Slice 审计；全量 web 355/355、core 370/370、lint/typecheck/build 绿。

## Browser flow tested
1. 条件操作符 + 分支（2→3）→ reload 保持
2. 导出端点 HTTP 200/zip（1973 bytes）
3. 测试数据已还原

## Screenshots
- `docs/audit/phase4-workflow-operator-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING（端口连线、strip、导出/导入按钮需人工复核）

## Hidden-debt scan
已扫；无本轮新增。

## Discovered Debt
- 工作流表面叠层命中问题部分修复；端口连线浏览器级最终 QA 待人工。

## Remaining Debt
- 端口连线/Strip/导出导入的人工视觉验收（Phase 4 功能层已齐，验收后即 COMPLETE）
