# LCOS Phase 3 Slice 1 Handoff — Mind Map 可编辑重挂接

## Status
SLICE COMPLETE；PHASE 3 = NOT COMPLETE（继续下一 slice）

## Scope implemented

- `reparentHierarchyNode` + `wouldCreateCycle`（ReparentCommand 语义：目标存在校验、自挂/成环拒绝、整棵子树移动、同父重排、失败零提交）。
- Mind Map 话题拖拽重挂接（拖到话题 = 挂到其下），非法操作即时提示。
- 层级渲染面（大纲/思维导图）只排已保存 Context 成员（includeOneHop=false），修复 Core VALIDATION 拒绝保存的真实缺陷。

## Files changed

- `apps/web/src/features/presentation/presentationHierarchy.ts`（新增 reparent/cycle/parentById）
- `apps/web/src/features/surfaces/ContextTreeSurface.tsx`（拖拽重挂接 + 拒绝提示）
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`（层级面精确成员）
- `apps/web/tests/presentationHierarchy.test.ts`（+3 用例）

## Contract changes
无（复用 presentation state.hierarchy 持久化）。

## State ownership
- 层级真相：Core `presentation:context:<scopeId>.state.hierarchy`（CAS 保存）。
- 内存 hierarchy 仅为乐观层，flush 失败 fail-closed。

## Persistence behavior
- reparent 提交后 reload 恢复；非成员引用被 Core 校验拒绝（已修复为成员级层级）。

## Failure behavior
- 成环/自挂：UI 提示 + 零写入。
- 保存失败：既有 fail-closed（只读 + 提示），不假装成功。

## Restart evidence
- Browser reload 层级恢复；Core 版本 4→5 并已还原测试项目快照。

## Targeted tests
- `presentationHierarchy.test.ts`（9 用例）。

## Full relevant regression
- web 329/329、lint/typecheck/build 绿。

## Browser flow tested
1. 思维导图打开（56 成员话题）
2. 拖拽重挂接 → Core 持久化（PUT ok）
3. reload → 层级恢复（Hierarchy v2）
4. 折叠分支截图
5. 还原测试项目 presentation 快照

## Screenshots
- `docs/audit/phase3-mindmap-reparent-1440x900.png`
- `docs/audit/phase3-mindmap-collapse-1440x900.png`
- `docs/audit/phase3-mindmap-reparent-persisted-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫；探针代码已移除。

## Discovered Debt
无新增（成员级层级缺陷已修复）。

## Remaining Debt（Phase 3 剩余 slice）
- Relationship Home：Context A→B 拖放提案（Ghost → Accept/Reject，Reject 零持久化）
- Signal Track：段模型 + reorder/split/merge/collapse/remove/add + 30+ 节点密度
