# Phase 3 Slice 1 — Mind Map 可编辑重挂接 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §6 Phase 3（Mind Map 支柱部分）。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）
Phase 3 整体：NOT COMPLETE（剩余：Relationship Home A→B 提案、Signal Track 段操作）

## Acceptance Evidence（Mind Map 子集）

### Reparent（§6.6）
Code:
- `apps/web/src/features/presentation/presentationHierarchy.ts`：`wouldCreateCycle`（沿祖先链环守卫）、`reparentHierarchyNode`（ReparentCommand：整棵子树移动、同父退化为兄弟排序、失败返回 null 不部分提交）。
- `apps/web/src/features/surfaces/ContextTreeSurface.tsx`：话题可拖拽，拖到另一话题 = 挂到其下；非法操作显示拒绝提示。

Tests: `presentationHierarchy.test.ts`（重挂整树、环拒绝、自挂拒绝、缺失目标拒绝、同父排序）。
Browser: 拖拽后 renderer badge v1→v2，Core 层级 0→56 节点、version 4→5。
Result: DONE

### Cycle rejection
Code: `wouldCreateCycle`（b 挂到其后代 c 下 → true → 拒绝）。
Tests: 断言返回 null 且原 state 未被改动。
Result: DONE

### Collapse/expand
Code: 既有 `toggleHierarchyCollapsed` + 话题工具按钮（与 Outline 共享同一 hierarchy state）。
Browser: 折叠截图。
Result: DONE（会话级；折叠不在持久化契约内，计划未要求跨 reload）

### Reload preserves hierarchy
Code: `usePresentationHierarchyState` → presentation bridge（Core `presentation:context:<scope>` state.hierarchy，CAS + rebase）。
关键修复：`ProjectionSurfaces` 对大纲/思维导图改用精确成员（includeOneHop=false），层级只含已保存 Context 成员；此前一跳邻居混入导致 Core VALIDATION 拒绝保存。
Browser: reparent → PUT ok → reload → badge Hierarchy v2 恢复。
Result: DONE

### Switching Track↔Mind Map loses no membership/hierarchy
Code: 同一 `context-hierarchy` presentation state 供 Outline / Mind Map 共享（同构渲染）。
Result: DONE（既有架构，本轮回归确认）

## Failure injection
- 自挂/成环 reparent → UI 拒绝提示 + 零持久化。
- 非成员节点进入层级 → Core VALIDATION（真实复现并修复为成员级层级）。
Result: PASS

## Restart / reload evidence
- Browser reload 后层级恢复（Hierarchy v2）。
- Core presentation 持久化 version 4→5（reparent）并还原为原快照（测试项目状态已复原）。

## Browser evidence
- 截图：`docs/audit/phase3-mindmap-reparent-1440x900.png`、`phase3-mindmap-collapse-1440x900.png`、`phase3-mindmap-reparent-persisted-1440x900.png`
- 网络/日志实录：PUT ok:true（修复后）、VALIDATION 拒绝（修复前）

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无本轮新增（探针已移除）。

## Discovered Debt（本轮发现并修复）
- Context 层级曾混入一跳邻居导致 Core 校验拒绝保存 → 层级渲染面改为精确成员。

## Remaining Debt（Phase 3 剩余，非本 slice 缺陷）
- Relationship Home：Context A→B 拖放 → 提案 Ghost → Accept/Reject（§6.2/§6.8）
- Signal Track：段模型与 reorder/split/merge/collapse/remove/add + 30+ 密度（§6.3-6.5/§6.8）
- 以上两项对应的失败注入与浏览器验收
