# LCOS Phase 4 Slice 1 Handoff — Workflow Operator / Ports / Run

## Status
SLICE FUNCTIONAL；PHASE 4 = NOT COMPLETE（继续 Slice 2）

## Scope implemented

- Operator 模型（condition / parallel-split / parallel-join / reference，无 serial）。
- 端口推导：普通 1/1、条件/并行分支 2+ 输出、并行汇合 N/1、引用只读。
- 条件分支编辑器：初始 2 分支、追加/删除（2 底限）、label/predicateText 编辑。
- 输出→输入端口连线（presentation 边 + branch.targetViewId 回写）；Delete 断边。
- Run 投影（active/completed/failed 节点样式，不产生 canonical 材料）。
- `workflowOperators` 经 workflow presentation state 持久化。

## Files changed

- `packages/contracts/src/presentations.ts`
- `apps/web/src/features/workflow/workflowOperators.ts`（新增）
- `apps/web/src/state/presentationOperatorState.ts`（新增）
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`（editor/ports/connect/run overlay）
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`、`App.tsx`（runOverlay 接线）
- `apps/web/src/reconstruction.css`
- 测试：`workflowOperators.test.ts`、`phase4Slice1Contract.test.ts`

## Contract changes
- PresentationStateV0 新增可选 `workflowOperators`（Presentation-only）。

## State ownership
- Operator 元数据：Core workflow presentation state（CAS + fail-closed）。

## Persistence behavior
- reload 保持；保存失败不假装成功。

## Failure behavior
- 自连不建边；分支删除受 2 底限；保存失败 fail-closed。

## Restart evidence
- reload 后操作符 active 保持。

## Targeted tests
- workflowOperators（5）、phase4Slice1Contract（4）；全量 web 355/355、lint/typecheck/build 绿。

## Browser flow tested
1. 工作流 surface 从 Selection 建流（2 节点）
2. 设「条件」→ 分支编辑器 2 行 → + 分支 → 3 行
3. reload → 操作符保持
4. 测试数据已还原（members/operators 清零）

## Screenshots
- `docs/audit/phase4-workflow-operator-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫；无本轮新增。

## Discovered Debt
- 工作流表面 header/编辑器与画布的叠层命中需人工视觉验收（已修 pointer-events/z-index 一处）。

## Remaining Debt
- 端口连线浏览器级最终 QA + 叠层视觉验收
- Phase 4 Slice 2：workspace strip（重排持久化）、.lcos-workflow.zip 导出/导入 + roundtrip fixture
