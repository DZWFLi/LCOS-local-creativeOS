# HU-4 Spatial Retrieval + HU-5 Boundary Guards — Handoff

## Status

**COMPLETE**（两阶段各自 Done 清单全勾；Remaining Debt 见文末）

---

## HU-4 Spatial Context Retrieval

### 目标达成

把用户“摆出来的关系”（hierarchy / presentation edges / 摆得近）变成确定性
Agent Recall hint，不自动生成 Domain Relation。

### Done 清单

- [x] source=spatial：候选携带 `source: 'spatial'` + `reason`
- [x] bounded neighborhood：same-parent ≤4、parent/child ≤4、edge ≤3、
  geometric top3、总上限 1–16（默认 6）
- [x] hierarchy：same-parent 0.70 / parent-child 0.80 / same-top-level 0.30
- [x] presentation edge：1-hop 0.75（只作 recall hint）
- [x] geometric proximity：0.35 × 1/(1+d/600)
- [x] no Domain mutation：守卫测试断言 relations 数量不变
- [x] Skill rule：retrieve-for-task + context-budget 明确
  “spatial candidate 只是 recall hint，先读内容再判断语义关系”
- [x] Ollama-independent：服务只依赖 repository（无 semantic 依赖）

### 实现

- `apps/local-core/src/spatial-retrieval-service.ts`（新）
- 路由 `POST /projects/:id/retrieval/spatial`（routes/retrieval.ts）
- CLI `lcos retrieval spatial <project> --seeds v1,v2 [--limit N]`
- 测试 `spatial-retrieval-service.test.ts` 4/4

### 真实 CLI 验收（自建项目 + presentation 种子）

```text
parent-child signal=0.8 Spatial 2
parent-child signal=0.8 Spatial 3
presentation-edge signal=0.75 Spatial 4
same-top-level signal=0.3 Spatial 5
```

## HU-5 Architecture Boundary + Late Writer Guards

### Done 清单

- [x] presentation legacy shrink-only（HU-3A importer freeze + presentationViewState 冻结）
- [x] semantic heuristic shrink-only（surfaceModel importer 冻结）
- [x] route/storage boundary（routes 禁裸 SQL / 直接 database handle）
- [x] provider boundary（domain/contracts/核心文件禁 import ollama/deepseek/semantic 适配器；
  注入只经组合层）
- [x] web boundary（web 禁 import metadata-repository / sqlite / phase2.sqlite）
- [x] late writer statuses（DerivedWriteGuardV0 →
  applied / skipped_deleted / skipped_stale）
- [x] preview/semantic negative tests（revision 已删 → skipped_deleted +
  preview FK 拒绝 dangling；embedding 文档已删/内容已变 → 丢弃）

### 实现

- `packages/contracts/src/derived-write.ts`（契约）
- repository：`commitDerivedResult`（artifact/resource/conversation 三路）、
  `commitSearchDocumentEmbedding`（语义向量提交守卫）
- semantic-index-service：embedding 提交带内容 hash 守卫，stale/deleted 丢弃
- `tests/architecture/hu5-boundary-guards.test.ts` 6/6
- `apps/local-core/tests/late-writer-guard.test.ts` 4/4

## Repo census

- 提交：`60f747c`（HU-3B）、HU-4（`feat(hu-4)`）、HU-5（`feat(hu-5)`）
- 全量：check:fast 全绿（web 283 / core 359 / 架构 104 / domain 5 / contracts 4 / build）

## Remaining debt

**NONE**

## Explicitly NOT implemented

- capture enrichment / file watcher postprocess 的守卫接线（本阶段提供机制 +
  preview/semantic 两路；其余 writer 用同一契约，按需接入）
