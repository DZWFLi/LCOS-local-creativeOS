# HU-3A Presentation Truth Purification — Completion Audit & Handoff

## Status

**COMPLETE**（按 04_HU3 施工文档 §17 Done 清单逐项验收；Remaining Debt 见文末，
非本 Phase 要求项已如实单列）

---

## 1. Completion Checklist（Phase 原文 §17）

### [x] Core PresentationView sole committed truth

- code：`apps/local-core/src/presentation-application-service.ts`（PresentationApplicationService）
  + `presentation_views` 表（schema v32）+ CAS save（expectedVersion）。
- evidence：`apps/local-core/tests/presentation-persistence.test.ts`、`apps/web/tests/presentationViewState.test.ts`
  （load / seed / CAS conflict retry / remote apply 全过）。

### [x] module Maps no durable ownership

- code：`apps/web/src/state/presentationDraftState.ts` / `presentationHierarchyState.ts`
  memory Map 明确为 optimistic working copy；写路径 `bridge.patch → flushSoon → Core CAS`；
  恢复路径从 Core 事件驱动读回（不把 memory 当 Truth）。
- evidence：web 280/280；浏览器重载后位置恢复（探针 RELOAD_RENDER_OK 3/3）。

### [x] no 200ms bridge polling

- code：`presentationDraftState.ts` / `presentationHierarchyState.ts` 删除 `setInterval(…, 200)`
  与 4s 超时兜底，改用 `bridge.subscribe`（事件驱动）。
- evidence：`rg "setInterval" apps/web/src/state/presentation*.ts` 无命中；
  `presentationImporterFreeze.test.ts` + web 全量通过。

### [x] positions persist

- code：`usePresentationDraftPositions` → `bridge.patch({ positions })` → Core presentation_views。
- evidence：`CORE_COMMIT_OK positions=3`（真实浏览器拖 3 节点，Core API 读回）；
  `apps/local-core/tests/presentation-persistence.test.ts`。

### [x] pins persist

- code：`usePresentationDraftPinnedIds` → `bridge.patch({ pinnedViewIds })`；
  位置+pin 同帧 patch 组合（`PresentationViewSessionCore.patch` 组合 #pending）。
- evidence：`CORE_COMMIT_OK pinned=3`；`presentationViewState.test.ts`「composes multiple patches」。

### [x] hierarchy persists

- code：`usePresentationHierarchyState` → `bridge.patch({ hierarchy })`；恢复 `contractToHierarchy`。
- evidence：既有 presentation-persistence 用例 + web 全量。

### [x] presentation edges persist

- code：`usePresentationDraftEdges` 过滤 `context-temp:*` 后经 `presentationEdges` 落 Core
  （契约待 HU-3B 正式化，见 §10；本 Phase Done 项为“edges persist”，已达成）。
- evidence：既有 presentation-persistence 用例 + web 全量。

### [x] transient preview explicitly nonpersistent

- code：`apps/web/src/state/gesturePreviewState.ts`（GesturePreviewStore：dragPositions /
  layoutGhost / dropTarget / alignmentGuides / relationHoverIds；无 persistence API、
  无 localStorage、无 Core mirror、手势结束 clear）。
- real path：`ContextGraphSurface` pointermove → `setDragPosition`（transient），
  pointerup → 一次 commit（positions + pinned 同一 flush）。
- evidence：`gesturePreviewState.test.ts`（无持久化 API 边界断言）+ 浏览器探针拖拽路径。

### [x] CAS/SSE reconcile

- code：`PresentationViewSessionCore.flush` CAS retry once（reload latest → re-apply pending →
  save）；`streamPresentation` SSE → `applyRemote`；bridge 注册事件通知恢复时序。
- evidence：`presentationViewState.test.ts`「retries once on CAS conflict」+
  「notifies bridge-registry subscribers」。

### [x] legacy importer freeze test

- code：`apps/web/tests/presentationImporterFreeze.test.ts`（draft/hierarchy 的 importer
  基线冻结，只许收缩）。
- evidence：2/2 通过（含在 web 全量 280 内）。

---

## 2. 隐藏欠账主动搜索（协议 §12）

搜索词：TODO / FIXME / setInterval / poll / in-memory Map / localStorage /
placeholder / fallback / not persisted。

发现并已修复：

1. **跨项目主键撞车静默串数据**（core，严重）— `PUT /graph` 幂等 upsert 的
   `ON CONFLICT(id) DO UPDATE` 不更新归属字段；通用 id（`scope-root`、`artifact-1`）
   跨项目复用时会改写别的项目的行。已加 `#assertOwnership` 归属守卫（快照导入 +
   mutation 全路径），跨项目 id 直接抛错整体回滚；同项目幂等重存不受影响。
   测试：`apps/local-core/tests/cross-project-id-guard.test.ts`（3 用例）。
2. **bridge.patch 同帧互相覆盖**（web）— #pending 替换语义，位置+pin 两个 patch
   只保留后者。改为组合 mutator。
3. **子组件先于父组件挂载导致恢复丢失**（web）— 旧 200ms 轮询兜的时序，
   改纯订阅后恢复路径失效。新增 bridge 注册/注销事件订阅。
4. **恢复被 key 同步 effect 覆盖**（web）— mirror 恢复只 setState 不写 memory，
   随后的 `useEffect` 把状态刷回空。恢复路径同步写回 optimistic memory。
5. **Phase E 遗留**：curator 契约测试停留在 V1 SKILL.md 断言、verify-retrieval.md
   86 字符 stub、runtime-v6 依赖 process.cwd、vitest 会把 Playwright spec 混跑。
   全部已修（见 feat(hu-3a) 提交）。

未处理（非本 Phase Done 要求，如实列出）：

- HU-3 §12 Core unavailable → 仍保持 memory optimistic + ready=false，GUI 的
  degraded/read-only 提示未做（属 GUI II 范畴，已记 OPEN_DEBTS）。
- HU-3 §10 `context-temp:*` 边过滤规则正式化 → HU-3B 切片的正式契约。
- HU-3 §13 whole-state derived replace 的盲 rebase 判断：当前 CAS retry 对组合
  mutator 重放，字段级 intent 已在本次修复中实现；derive-replace 的语义分级留 HU-3B。

---

## 3. Repo census

- 分支：`research/huabu-gap-audit-20260811`
- 新提交：`6a84afa`（cross-project ownership guard）、`cf1a61d`（presentation 恢复时序
  + patch 组合 + 探针）
- 相关文件：
  - `apps/local-core/src/metadata-repository.ts`（归属守卫）
  - `apps/local-core/tests/cross-project-id-guard.test.ts`（新）
  - `apps/web/src/state/presentationViewState.ts`（patch 组合 + bridge 注册通知）
  - `apps/web/src/state/presentationDraftState.ts` / `presentationHierarchyState.ts`
  - `apps/web/src/state/gesturePreviewState.ts`（新）
  - `apps/web/src/features/surfaces/ContextGraphSurface.tsx`（手势层接入）
  - `apps/web/tests/presentationViewState.test.ts` / `gesturePreviewState.test.ts` /
    `presentationImporterFreeze.test.ts`（新/改）
  - `packages/skills/lcos-project-curator/`（V2 契约修复）
  - `tests/architecture/lcos-project-curator-contract.test.ts` / `runtime-v6.test.ts`
  - `vitest.config.ts`（排除 tests/e2e Playwright）
  - `tests/e2e/hu3-gesture-persistence-probe.mjs`（新，浏览器验收探针）

## 4. Contracts changed

- 无对外 contract 变更；新增内部 `subscribePresentationBridge(key, listener)`。

## 5. Persistence / Transaction / Concurrency / Failure semantics

- 持久化：PresentationView → SQLite `presentation_views`（version CAS）；快照导入
  单事务（DELETE + 重插 + COMMIT/ROLLBACK）。
- 并发：同帧多 patch 组合后一次 CAS；冲突 reload latest → 重放组合 mutator → retry once。
- 失败：跨项目 id 撞车抛错回滚；Core 不可用时保持乐观层（GUI 降级提示留给 GUI II）。

## 6. Restart / reload evidence

- 浏览器重载：`RELOAD_RENDER_OK rendered=3/3`（探针，真实项目数据 + 真实用户路径：
  框选 → 当前 Selection → 关系图 → 拖 3 节点 → Core 校验 → 重载 → 渲染校验）。
- Core 重启：presentation-persistence / restart 相关用例 + 全新进程下探针项目
  seed/save 校验（隔离 core 实测 PUT /graph 全量落库）。

## 7. Targeted tests

- `cross-project-id-guard.test.ts` 3/3
- `presentationViewState.test.ts` 7/7（含 patch 组合、registry 通知）
- `gesturePreviewState.test.ts` 2/2
- `presentationImporterFreeze.test.ts` 2/2
- `hu3-gesture-persistence-probe.mjs`（浏览器）：CORE_COMMIT_OK 3/3 + RELOAD_RENDER_OK 3/3

## 8. Full relevant regression

- web 280/280、core 351/351、架构 98/98、domain 5/5、contracts 4/4
- `npm run check:fast` 全绿（lint → typecheck → test → architecture → build）

## 9. Discovered debt during this phase

见第 2 节；全部已修或已如实转列（OPEN_DEBTS）。

## 10. Remaining debt

**NONE**（本 Phase §17 Done 全勾；§12 的 GUI 降级提示与 §10/§13 的正式化属
HU-3B / GUI II 既定范围，非本 Phase 要求）

## 11. Explicitly NOT implemented

- Core unavailable 时的 GUI degraded/read-only 提示（HU-3 §12 建议项，A–H 不造
  offline log；GUI II 处理）
- Reorganize Ghost GUI 消费 `layoutGhost`（HU-3 §16 只要求提供槽位，已提供）

## 12. Commit

- `6a84afa fix(hu-3a): cross-project primary-key ownership guard`
- `cf1a61d fix(hu-3a): presentation 恢复时序 + 同帧 patch 组合（真实浏览器验收修复）`
