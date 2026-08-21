# LCOS Phase 3 Slice 2 Handoff — Relationship Home

## Status
SLICE COMPLETE；PHASE 3 = NOT COMPLETE（继续 Slice 3）

## Scope implemented

- 关系首页：已保存 Context 视图（有成员的 context scope）作为主节点展示，成员数实时。
- A 拖到 B → `context-membership-proposal`（内容身份去重后的真正新增）→ Ghost 提案卡 → 接受/拒绝。
- 接受 = 只把新增成员投影进目标 scope（不移动、不删除源）；拒绝 = 零写入。

## Files changed

- `apps/web/src/features/context/contextMerge.ts`（新增，提案纯函数）
- `apps/web/src/features/surfaces/ContextGraphSurface.tsx`（关系首页 + 提案 UI）
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`（透传 contextViews / onContextMergeAccept）
- `apps/web/src/App.tsx`（savedContextViews + acceptContextMerge + 空视图过滤）
- `apps/web/src/reconstruction.css`（关系首页/提案样式）
- 测试：`contextMerge.test.ts`（4 用例）、`phase3Slice2Contract.test.ts`（3 用例）

## Contract changes
无 Core 契约变更；复用 artifact_views.scope_id 与既有投影机制。

## State ownership
- Context 视图成员真相：Core artifact_views.scope_id。
- 提案为纯前端临时状态，Accept 前零持久化。

## Persistence behavior
- Accept 创建的视图立即落库；reload 保持。

## Failure behavior
- 自拖/缺失目标/空新增：不产生写入并给出提示。

## Restart evidence
- Browser reload 后成员计数保持。

## Targeted tests
- `contextMerge.test.ts`、`phase3Slice2Contract.test.ts`。

## Full relevant regression
- web 336/336、lint/typecheck/build 绿。

## Browser flow tested
1. 关系首页展示保存的 Context 视图
2. A→B 提案（内容去重后 3 项）
3. 接受 → B +3、A 不变
4. B→A 提案（8 项）→ 拒绝 → 零变更
5. reload → 计数保持
6. 清理 20 个测试视图，项目还原（A=1、B=0）

## Screenshots
- `docs/audit/phase3-relationship-home-proposal-1440x900.png`
- `docs/audit/phase3-relationship-home-after-accept-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫；无本轮新增。

## Discovered Debt
无。

## Remaining Debt（Phase 3 剩余 slice）
- Signal Track：段模型 + reorder/split/merge/collapse/remove/add + 30+ 节点密度
