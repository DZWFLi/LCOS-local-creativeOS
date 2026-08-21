# Phase 4 Slice 1 — Workflow Operator / Ports / Run 投影 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §7.1-7.3 / §7.5 / §7.7（operator 部分）。
> 日期：2026-08-12

## Status
SLICE FUNCTIONAL（代码 + 单测 + 持久化通过；端口连线浏览器级最终 QA 待人工/下一轮视觉验收）
Phase 4 整体：NOT COMPLETE（剩余：workspace strip、导出/导入、完整浏览器验收）

## Acceptance Evidence

### Operator model（§7.1）
Code:
- `packages/contracts/src/presentations.ts`：`WorkflowOperatorV0` / `WorkflowOperatorKindV0`（condition / parallel-split / parallel-join / reference，无 serial——串行即边）。
- `features/workflow/workflowOperators.ts`：设置/清除、分支增删改、端口数推导。
Tests: `workflowOperators.test.ts`（kind 集合、端口数、分支 2 底限、predicateText 更新）。
Result: DONE

### Condition 2+ named output branches（§7.2/7.3）
Code: `setWorkflowOperator` 初始化 2 条默认分支；`addConditionBranch` 追加；`updateConditionBranch` 编辑 label/predicateText（创作内容，Core 不执行）。
Browser: 设「条件」→ 分支编辑器 2 行 → + 分支 → 3 行。
Result: DONE

### Port hover / connect / disconnect（§7.2）
Code: `portCounts` 驱动输入/输出端口（普通 1/1、条件/并行分支 2+ 输出、并行汇合 N/1、引用只读 1/0）；输出端口拖到输入端口建 presentation 边并回写 branch.targetViewId；Delete 删边（既有）。
Browser: 端口 DOM 存在且数量随 operator 变化；连线浏览器级最终 QA 待人工（测试环境叠层命中问题，见下）。
Result: FUNCTIONAL（人工视觉验收待签）

### Parallel split / join
Code: 同一端口模型（split 1/N，join N/1），无 serial operator。
Tests: `portCounts` 断言。
Result: DONE

### Run overlay（§7.5）
Code: `runOverlay` prop → `run-active/run-completed/run-failed` 节点样式；App 从 activeRun 投影 targetIds（Run 节点不成为 canonical 项目材料）。
Tests: `phase4Slice1Contract.test.ts`。
Result: DONE（有真实 Run 时需视觉复核）

### Persistence（Presentation-only）
Code: `state/presentationOperatorState.ts` 经 workflow presentation bridge（CAS + fail-closed）持久化 `workflowOperators`。
Browser: 设置操作符 → reload 后按钮仍为 active（Core state 持久化）。
Result: DONE

## Failure injection
- 非法端口目标/自连：`endLink` 自连不建边（代码路径）；纯函数拒绝自合并/空拆分（测试）。
- 保存失败：既有 fail-closed。
Result: PASS（单元级）

## Restart / reload evidence
- reload 后 workflowOperators 保持（Core state_json version 递增）。

## Browser evidence
- 截图：`docs/audit/phase4-workflow-operator-1440x900.png`（操作符 + 分支编辑器）
- 实录：条件操作符设置、分支 2→3、reload 后 active 保持
- 测试数据已还原（members=0、operators=0）

## Known visual issue（Discovering Debt，下一轮修）
- Workflow 表面 header/编辑器与画布/来源栏存在叠层命中问题（测试中 editor 曾不可点；已修 pointer-events + z-index 一处，但完整视觉验收仍待人工/UI）。

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无新增（QA 阶段未引入 mock/placeholder）。

## Remaining Debt
- 端口连线浏览器级最终 QA + 叠层视觉验收
- Phase 4 剩余：workspace strip、.lcos-workflow.zip 导出/导入与 roundtrip fixture
