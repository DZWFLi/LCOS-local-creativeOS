# Phase 3 Slice 2 — Relationship Home Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §6.2 / §6.8（Relationship 部分）。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）
Phase 3 整体：NOT COMPLETE（剩余：Signal Track 段操作）

## Acceptance Evidence

### Item 1 — all saved Context views recoverable
Code: `App.tsx` `savedContextViews`（`scope.kind === 'context'`，成员 = 该 scope 的视图；有成员才展示）。
Browser: 关系首页列出 客户需求(5) / 视觉参考(7→10)，reload 后恢复。
Result: DONE

### Item 2 — A→B drop first produces proposal
Code:
- `features/context/contextMerge.ts`：`proposeContextMergeCandidate`（差集 + 内容身份去重）。
- `ContextGraphSurface`：关系首页视图节点可拖，拖 A 到 B 只产生提案，不写任何数据。
Browser: 拖 客户需求 → 视觉参考 → 提案「3 个成员加入」（doc003/004 按 artifact 去重）。
Result: DONE

### Item 3 — Reject = zero durable change
Browser: B→A 提案（8 项）→ 拒绝 → 双方计数不变（A=5、B=10），无任何 mutation。
Result: DONE

### Item 4 — Accept adds only intended membership
Code: App `acceptContextMerge` → `projectViewsIntoScope(additions, targetScopeId)`（按 canonical artifact key 去重，只新建缺的视图）。
Browser: 接受后 A=5 不变、B 7→10（恰好 +3），源视图内容未改动。
Result: DONE

## Failure injection
- 自拖/缺失目标 → `proposeContextMergeCandidate` 返回 null（测试）。
- 目标上下文视图不存在（接受时）→ notice「目标上下文视图已不存在，未做任何修改」。
- 空 additions → notice「目标已包含全部成员，无需合并」，零写入。
Result: PASS

## Restart / reload evidence
- Browser reload 后 A=5 / B=10 保持（Core artifact_views.scope_id 持久化）。

## Browser evidence
- 截图：`docs/audit/phase3-relationship-home-proposal-1440x900.png`、`phase3-relationship-home-after-accept-1440x900.png`
- 计数实录：提案前 A5/B7 → 接受 A5/B10 → 拒绝 A5/B10 → reload A5/B10
- 清理后还原：A=[view-golden-conv-client]、B=[]（删除 20 个测试视图）

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无本轮新增。

## Discovered Debt
无（合并按内容身份去重、空视图过滤均已实现）。

## Remaining Debt（Phase 3 剩余）
- Signal Track：段模型 + reorder/split/merge/collapse/remove/add + 30+ 节点密度（§6.3-6.5/§6.8）
