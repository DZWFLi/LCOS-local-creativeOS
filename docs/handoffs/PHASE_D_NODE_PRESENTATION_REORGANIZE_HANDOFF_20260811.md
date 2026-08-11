# Phase D Handoff｜Node / Relation / Presentation + Agent Reorganize

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase D 目标：把"画布有功能"收成"人和 Agent 真能共同整理"。本轮完成：

1. **ReorganizeProposal 契约 + 服务**（D16/D19）：`ReorganizeProposalV0`（mergeCandidates / removeMemberViewIds / artifactDeleteCandidates / hierarchyPatch / relationPatch / emphasisPatch / layoutIntent）；服务支持 create → preview → apply → rollback → reject，proposal 持久化（schema v28，重启可恢复），**destructive 删除必须显式 confirmDestructive=true**。
2. **apply 语义**（D14/D15/D30）：merge 时移除被合并 source view（汇总节点由 Agent 提交前创建）；Presentation 移除 ≠ Artifact 删除；artifact 级联删除（views/revisions，file_records 保留）单独闸门。
3. **rollback**（D19）：应用前存 presentation 快照，回滚恢复 members/hierarchy/emphasis/edges；已删 artifact 不可恢复（应用前预览已明示）。
4. **auto-pin**（D18）：任何明确手工拖拽 → `positionLocked: true`（layout 引擎自动跳过）；用户可手动解锁（togglePositionLock）。
5. **AgentContextSurface 降噪**（D24）：默认折叠成右上角小胶囊（有确认项时显示角标），点开才是详情卡，不再常驻大卡片挡画布。
6. **已有能力核查**（不重复造）：`CurationPatchV0` 已覆盖 createTexts/relations(provenance)/presentation(hierarchy/emphasis/pin/edges)；`visualFamily` 已用于 CanvasNodeVisual；`spatialLod` 已有 LOD 契约；layout 引擎（ELK/fCoSE）已就绪。

## Backend / Runtime

新增：

- `packages/contracts/src/reorganize.ts`（Proposal + Preview）
- `apps/local-core/src/reorganize-service.ts`
- `scripts/phase-d-smoke.mjs`

修改：

- `apps/local-core/src/metadata-repository.ts`（v28 `reorganize_proposals` 表 + `deleteArtifact` 级联 + proposal CRUD）
- `apps/local-core/src/compose.ts` / `server.ts`（reorganize 装配 + 4 个路由）

## GUI / Frontend

- `apps/web/src/features/canvas/ProjectCanvas.tsx` —— 拖拽落点自动 pin
- `apps/web/src/features/shell/AgentContextSurface.tsx` —— 折叠胶囊（默认收起）
- `apps/web/src/porcelain-studio.css` —— 胶囊样式（沿用现有 ps 设计语言）

## Node / Relation / Presentation semantics

- Identity = stable ID；Display = title/visualFamily/preview；Presentation = position/hierarchy/membership（与 D1 冻结一致）。
- Presentation 移除与 Artifact 删除两段式：safe-ish vs destructive。
- hierarchy 是 Presentation primitive（parentByViewId + orderByParent），Outline/MindMap 同一数据（契约已支持，前端投影已有）。
- relation 走 provenance（origin/createdBy/evidence/confidence 已有契约）。

## Tests

- Core：66 文件 / 327 用例全过（新增 `reorganize-service.test.ts` 5 用例）
- `node scripts/phase-d-smoke.mjs`：capture×3 → presentation → proposal → preview → apply → destructive 闸门 → rollback → reject —— 全过

## Manual evidence

- 真实 Core 独立端口跑通完整 Reorganize 生命周期。
- AgentContextSurface 折叠胶囊过了 typecheck/test；真人点击验收列 Phase H。

## Explicitly NOT implemented

- ❌ Anchored Note（D9）：notes anchorRefs 字段与"点击定位回目标"交互留 Phase H（契约方向已明确：type view|artifact + id）
- ❌ Ghost Preview GUI（D17）：proposal 可视化（Before → Ghost After → Apply）留 Phase H（后端 preview API 已可用）
- ❌ merge 摘要生成：需要 LLM，由 Curator Skill 在提交 proposal 前创建汇总节点（Core 只执行，符合 D30）
- ❌ Edge LOD 精细调优（D8 基础已有 spatialLod，细调留 Phase H/I）

## Next risks

1. rollback 只恢复 presentation 快照：已删 artifact 不可恢复 —— 应用前 preview 已标 destructive，未来可考虑 soft-delete（Phase I 决策）。
2. AgentContextSurface 折叠 state 与 App 的 detailsOpen 弱耦合：外部切换时可能不同步，Phase H 统一。
3. proposal 无 TTL 清理：长期堆积可清理（Phase I）。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

