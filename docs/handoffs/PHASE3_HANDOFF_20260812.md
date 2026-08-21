# LCOS Phase 3 Handoff

## Status
COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Scope implemented（三个 slice）

- Slice 1（Mind Map）：ReparentCommand + 环守卫 + 成员级层级持久化（拖拽重挂接、折叠、reload 恢复）。
- Slice 2（Relationship Home）：保存的 Context 视图主节点、A→B 合并提案（内容身份去重）、Accept 只加目标成员 / Reject 零持久化。
- Slice 3（Signal Track）：Presentation-only 段模型 + reorder/split/merge/collapse/remove/add + 机械密度 + reload 持久化。

## Files changed（Phase 3 汇总）

- `packages/contracts/src/presentations.ts`（ContextTrackSegmentV0 / trackSegments）
- `apps/web/src/features/presentation/presentationHierarchy.ts`（reparent/cycle）
- `apps/web/src/features/context/contextMerge.ts`、`trackSegments.ts`（纯函数）
- `apps/web/src/state/presentationHierarchyState.ts` 依赖（既有）、`presentationTrackState.ts`（新增）
- `apps/web/src/features/surfaces/ContextTreeSurface.tsx`、`ContextGraphSurface.tsx`、`ContextFlowSurface.tsx`、`ProjectionSurfaces.tsx`
- `apps/web/src/App.tsx`（savedContextViews / acceptContextMerge）
- `apps/web/src/reconstruction.css`
- 测试：presentationHierarchy（9）、contextMerge（4）、trackSegments（8）、phase3Slice2/3 contract（6）、其它回归

## Contract changes
- PresentationStateV0 新增可选 `trackSegments`（Presentation-only，不新增 Core 业务实体）。

## State ownership
- 层级/段：Core PresentationView.state（hierarchy / trackSegments），CAS + fail-closed。
- 关系首页成员：Core artifact_views.scope_id。

## Persistence behavior
- Mind Map 层级、Track 段、Context 视图成员均 reload 保持；失败不假装成功。

## Failure behavior
- 成环/自挂 reparent：拒绝 + 提示。
- 合并自拖/缺失目标/空新增：零写入 + 提示。
- 段空拆分/空合并：纯函数拒绝。

## Restart evidence
- Browser reload：层级 v2 恢复、Track 段/计数恢复、Context 成员计数保持。

## Targeted tests
- 见三个 slice 审计；全量 web 347/347、core 367/367、lint/typecheck/build 绿。

## Browser flow tested
1. Mind Map 拖拽重挂接 → Core 持久化 → reload 恢复
2. 关系首页 A→B 提案（去重后 3 项）→ 接受 +3 / 拒绝零变更 → reload 保持
3. Track add/collapse/split/merge/reorder/remove → Core trackSegments → reload 恢复
4. 测试数据与 presentation 快照已还原

## Screenshots
- `docs/audit/phase3-mindmap-reparent-1440x900.png`、`phase3-mindmap-collapse-1440x900.png`、`phase3-mindmap-reparent-persisted-1440x900.png`
- `docs/audit/phase3-relationship-home-proposal-1440x900.png`、`phase3-relationship-home-after-accept-1440x900.png`
- `docs/audit/phase3-track-controls-1440x900.png`、`phase3-track-persisted-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING（三块均需人工/视觉签字）

## Hidden-debt scan
各 slice 已扫，无本轮新增。

## Discovered Debt
- Golden 测试项目残留两个空「合并源A」context scope 行（无成员、关系首页已过滤，不显示；如需可后续加 scope 删除端点）。

## Remaining Debt
NONE（Phase 3 验收范围内）
