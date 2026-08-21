# Session 2 Handoff｜Handoff / Session Summary 进入 Context History

## Goal

把 Session 1 真实产出的 Handoff / Session Summary 变成 Context 的真实历史与沉淀来源，不做 Handoff 管理后台，不暴露 provider runtime 内部细节，不在前端自造副本。

## Baseline

- branch: `codex/r1-vision-merge-20260812`
- HEAD（实施前）: `c1b24b8`
- dirty files before: 无
- dirty files after: 本 Session 的代码 + 测试 + 本文档

## Authoritative path after this session

```text
Agent Return → Core SessionSummary + Handoff（Session 1 已落地）
→ Web listHandoffs(projectId)（Core truth，runReviews 变化时刷新）
→ handoffToProjection()（纯映射：from/to/label/meta，无副本存储）
→ ContextHistoryRail（Context 详情 surface）
→ Context Deposit Candidates（id: handoff:<id>）
```

修复了一个真实硬编码空投影：

- `App.tsx` `handoffs: []` → `handoffs: coreHandoffs.map(handoffToProjection)`
- `ProjectionSurfaces` 的 `contextRuntime` 不再只对 `sourceKind==='conversation'` 开放，任意 Context 详情（Flow/Tree）都能看到 Context History

## Files changed

- `apps/web/src/features/surfaces/surfaceContracts.ts`：`SessionHandoffProjection.meta`
- `apps/web/src/features/surfaces/handoffProjection.ts`：新增纯映射函数
- `apps/web/src/features/surfaces/ContextHistoryRail.tsx`：渲染 meta（决定/未决/产物数）
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`：解除 conversation 门
- `apps/web/src/App.tsx`：coreHandoffs 状态 + listHandoffs 加载 + 投影 + deposit 候选
- `apps/web/src/reconstruction.css`：mini meta 样式
- `apps/web/tests/handoffContextHistory.test.ts`：新增 5 用例
- `tests/e2e/handoff-context-history.spec.ts`：新增 2 用例

## Tests actually run

| command | result |
|---|---|
| `npm run typecheck`（4 包） | PASS |
| `vitest handoffContextHistory.test.ts` | 5/5 PASS |
| `npm run test --workspace web` | 100 文件 / 460 用例 PASS |
| `npm run build` | PASS |
| `npx playwright test tests/e2e/handoff-context-history.spec.ts` | 2/2 PASS |
| `npm run test:e2e`（全量） | 19/19 PASS |

## Manual smoke actually run

真机浏览器（Playwright + 真实 Local Core / Vite）：

1. 通过 API 写入真实 Handoff（`S2 真机验证交接`，1 决定 / 1 未决 / 1 产物）→ 进入 Context 详情（思维导图投影）→ Context History 显示标题与「1 决定 · 1 未决 · 1 产物」。
2. reload 后重新进入同一 Context → 仍可见（Core truth 持久）。
3. 无 Handoff 时无空壳（`.lcos-handoff-mini-list` 不存在）。

## Acceptance checklist

- [x] Session 1 创建的真实 Handoff 能在 Context History 看到（真机浏览器验证）
- [x] reload 后仍可见（Core truth，非前端副本）
- [x] 无 handoff 时无空壳卡片（rail 空态即不渲染）
- [x] Handoff 作为 Context Deposit Candidate source（`id: handoff:<id>`，源契约测试锁定）
- [x] 删除 / 生命周期遵循 Core truth（只读 listHandoffs + 投影，前端不保存副本）
- [x] `handoffs: []` 硬编码空 projection 已消除
- [x] 不新增独立 Handoff 页面（仍在 Context History rail 内）

## Remaining debt discovered in this Session

1. 「从选择沉淀上下文」右键流程在真机 E2E 里未产出 Context（菜单动作执行后 context-graph 无 dot，疑似 presentation mutation 与 scope 持久化时序问题）。本次冒烟改为直接种 Context 验证 S2 主链；该债与 S5/S6 的 Context 创建/成员语义相关，留证据于此，未在本 Session 根因化。
2. Deposit Hint 的「真实可见性」依赖 cooldown + evidence 门，未做真机时序验证；候选来源已由源契约测试锁定。

## Explicitly not done

- 未做 Handoff 管理后台 / 删除 UI（按计划不做）；
- 未根因化「从选择沉淀上下文」流程问题；
- 未进 Session 3。

## Risk / rollback point

- 回滚点：`c1b24b8`。改动全部为只读投影（listHandoffs + 纯映射），不改变 Core 数据结构。

## Verdict

**PASS**
