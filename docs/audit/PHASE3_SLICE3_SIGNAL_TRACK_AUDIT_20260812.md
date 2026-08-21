# Phase 3 Slice 3 — Signal Track Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §6.3-6.5 / §6.8（Signal Track 部分）。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Acceptance Evidence

### Vertical + order obvious
Code: `ContextFlowSurface` 关系链垂直堆叠为段，控件条显示「第 N 段」+ 密度 + 计数；`createSegmentsFromStrands` 保序。
Browser: 55 段垂直排布，摘要「55 段 · 折叠 0」。
Result: DONE

### Expand / collapse
Code: `toggleTrackSegmentCollapsed` + 控件；折叠段隐藏成员节点（不删内容）。
Browser: 折叠第 1 段 → 可见节点 59→55，摘要「折叠 1」；展开恢复。
Result: DONE

### Reorder
Code: `reorderTrackSegment`（↑/↓，order 同步）。
Browser: 段上移后标签重编号（拆分标签保留后缀）。
Result: DONE

### Split / merge
Code: `splitTrackSegment`（选中成员拆新段）、`mergeTrackSegments`（去重并入上一段）。
Browser: 55→56（拆分）→55（合并）。
Result: DONE

### Drop Collection/Context + add members
Code: 段可接收 drop（text/plain 节点 id）+「把当前选中加入此段」（全局去重）。
Browser: 选中 2 个节点加入段 → 计数 +2。
Result: DONE

### Remove membership without deleting Artifact
Code: `removeTrackSegmentMember`（只移出段，空段自动清理）。
Browser: 移除成员 → 段计数 -1；内容节点仍在项目。
Result: DONE

### 30+ nodes not one unbroken list
Browser: 59 节点分布在 55 段，非单一长列表。
Result: DONE

### Durable track order (Presentation-only)
Code: `presentations.ts` 契约新增 `ContextTrackSegmentV0` / `trackSegments`；`state/presentationTrackState.ts` 经既有 presentation bridge（CAS + fail-closed）持久化，首次有种子时写入一次。
Browser: Core `trackSegments` 55 段 version 14；reload 后摘要/计数恢复。
Result: DONE

### Track ↔ Mind Map no loss
Code: trackSegments 独立于 hierarchy，两者都只读同一 presentation membership；Track 操作不触碰 Mind Map 层级。
Result: DONE（架构隔离，回归确认）

## Failure injection
- 空拆分/空合并/自合并 → 纯函数返回 null（测试）。
- 保存失败 → 既有 fail-closed（只读 + 提示），不假装成功。
- 段控件被节点遮挡 → 真实复现并修复（预留 28px 控件条 + pointer-events/z-index）。
Result: PASS

## Restart / reload evidence
- Browser reload 后段数/计数/折叠恢复；Core state_json 持久化。

## Browser evidence
- 截图：`docs/audit/phase3-track-controls-1440x900.png`、`phase3-track-persisted-1440x900.png`
- 实录：add +2 / collapse 59→55 / split 55→56 / merge 56→55 / reorder / remove / reload 恢复
- 测试后已还原 presentation（trackSegments 移除）

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无本轮新增。

## Discovered Debt
无（控件遮挡、标签重编号均已修复）。

## Remaining Debt
无
