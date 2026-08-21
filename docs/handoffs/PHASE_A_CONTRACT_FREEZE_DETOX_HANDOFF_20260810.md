# Phase A Handoff

## Completed

- Relation endpoint ownership 补齐 view / workspace（artifact→workspace、workspace→artifact、view→workspace、workspace→view 四种方向可创建/重载/删除；跨 Project 400 拒绝）
- `PresentationViewV0` 契约冻结（`packages/contracts/src/presentations.ts`）：member/position/hierarchy/presentationEdges/pinned/emphasis/renderer/capability，version 与 graphVersion 独立；明确排除业务 ontology 与 camera/hover/selection
- `CurationNodeV0` / `CurationReadResultV0` 查询契约冻结（`packages/contracts/src/curation.ts`）：stable ref + bounded text + evidence handles，无表结构泄露
- `PresentationApplicationService` + `PresentationRepository` 骨架（不落库、无 SQL、Route 不得内联编排）
- `isRuntimeProjectMode()` helper + 存储边界 invariant 测试（runtime 语义变更只走 Core mutations，不回退 prototypeStorage）
- 4 处 legacy heuristic 加 `DEPRECATED_BEHAVIORAL_HINT`（NodeKind / WorkspaceIntent / title regex / process-node heuristic），并加架构规则禁止新 Presentation/Curation 代码依赖它们

## Files changed

```text
apps/local-core/src/routes/entity.ts                       A1 端点校验
apps/local-core/tests/relation-endpoint-contract.test.ts   A1 行为测试（2 用例）
packages/contracts/src/presentations.ts                    A2 新契约
packages/contracts/src/curation.ts                         A5 新契约
packages/contracts/src/index.ts                            导出
apps/local-core/src/presentation-application-service.ts    A4 骨架
apps/local-core/src/presentation-repository.ts             A4 骨架
apps/web/src/runtime/projectMode.ts                        A6 helper
apps/web/src/App.tsx                                       保存分支引用 helper
apps/web/src/model.ts                                      A7 注释
apps/web/src/features/canvas/CanvasNodeVisual.tsx          A7 注释
apps/web/src/runtime/runtimeBridge.ts                      A7 注释
apps/web/src/features/surfaces/capabilityViewResolver.ts   A7 注释
tests/architecture/presentation-contract.test.ts           A8
tests/architecture/relation-endpoint-contract.test.ts      A8
tests/architecture/curation-contract.test.ts               A8
tests/architecture/storage-boundary-invariant.test.ts      A8
```

## Contracts frozen

```text
PresentationViewV0（schemaVersion 0）
PresentationCapabilityV0 / PresentationEmphasisV0 / PresentationStateV0
CurationNodeV0 / CurationReadResultV0 / CurationSourceRefV0
Relation endpoint：artifact / note / scope / view / workspace 全部可校验
版本语义：graphVersion（domain mutation）≠ presentation.version（presentation mutation）
```

## Migrations

```text
无（Phase A 明确不落 presentation 表）
```

## Tests run

```text
npm run lint                        : 0 error（存量 warning）
npm run typecheck                   : PASS
npm run test                        : web 251/251 · core 260/260 · domain 5/5 · contracts 4/4
npm run test:architecture           : 86/86（新增 4 个套件 18 用例）
npm run build                       : PASS
```

## Acceptance evidence

```text
Relation endpoint：4 方向 PUT 200 → GET list 存在 → DELETE 200 → 消失；跨项目 4 组合全部 400
Contract snapshot：presentations.ts / curation.ts 已入库（提交 e786cab）
No-user-visible-regression：A1 只放宽端点校验（原 view/workspace 一律拒绝）；
  A6 仅把 bootMode==='runtime' 判定换成等义 helper；A7 仅注释；GUI 行为无变化
```

## Known compatibility paths still present

```text
prototypeStorage（fixture 模式仍允许）
projectNavigation（localStorage 相机）
presentationDraftState / presentationHierarchyState（内存，未迁移）
WorkspaceIntent / NodeKind / title-regex / process-node heuristic（保留运行，已标注 DEPRECATED_BEHAVIORAL_HINT）
Conversation Sections / ContextManifest / lcos-project-context Skill（未动）
```

## Explicitly NOT implemented

```text
SQLite v21 / presentation 表 / Presentation HTTP / SSE / GUI 状态迁移 / ELK·fCoSE
CLI 新命令 / Skill / Ollama / Bridge 改动
```

## Risks for next phase

```text
Phase B 将落 presentation 持久化：需在 active_contexts（现有 CAS 投影）与
PresentationViewV0 新表之间明确读写边界，避免双写。
GUI 现有 presentationDraftState 是内存 Map，迁移时要保留拖拽/剪开/层级行为不变。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commits : 2b567d4（A1）· e786cab（A2/A5）· adb4570（A3/A4/A6/A7/A8）
HEAD    : adb4570
```
