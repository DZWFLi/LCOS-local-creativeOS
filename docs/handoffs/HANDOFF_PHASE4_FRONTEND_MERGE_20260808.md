# Handoff — Phase 4 前端合并验收 + 后端边界核对（2026-08-08）

## 1. 本轮输入

- `frontend-package-20260808-completion-phase4-evaluation.zip`（Phase 4 vNext 重构前端，87 个文件）
- `LCOS_UI_Reconstruction_Pass_V1_实施与QA报告_20260807.md`（前端自证报告）
- `PHASE4_BACKEND_BOUNDARIES.md`（后端需要弥补的 4 条边界）

## 2. 合并与编译修复

前端全树迁入 `apps/web/src`，并附带 `scripts/validate-vnext-phase4.mjs`、`tests/e2e/vnext-phase4.spec.ts`。

编译/契约修复：
- `App.tsx` ContextHistoryEntry 类型标注
- `SurfaceDock.tsx` lensForSurface 类型收窄
- 8 个旧契约测试更新到 Phase 4 语义（底部 dock 导航、Collection/投送、Composer、无 NodeContextToolbar、无“保存当前工作现场”、canvas-hud/canvas-world/minimap 新语法）
- `playwright.config.ts` 复用正在运行的 dev server
- `scripts/gatef-core-smoke.mjs` schemaVersion 断言 18 → 20

## 3. 验证链（真实结果）

| 检查 | 结果 |
| --- | --- |
| `npm run check:fast`（lint → typecheck → 单测 → 架构 → build） | 全绿；web 134/134、core 258/258、架构 70/70、build 成功 |
| `.codex-runtime/css-convergence-check.mjs` | 20/20 PASS |
| `npx playwright test tests/e2e/vnext-phase4.spec.ts` | 2 过 1 跳过 |
| 真实 HTTP（Core 43121） | schema v20；`/projects`、`/projects/disposable-mvp-sample/graph` 正常（8 节点/6 视图/3 关系/3 工作区） |
| 真实浏览器抽查（5173，agent=codex） | 自由画布 9 节点 6 边；上下文 9 对象 + ContextHistoryRail；运行 3；交付 6；大纲 9 objects 层级列表；底部 dock 六个入口全部可切 |

## 4. 后端边界核对结论（PHASE4_BACKEND_BOUNDARIES）

### 边界 1：Workspace 聚合关系端点 —— ✅ 已闭环
Core domain 此前已把 `RelationEntityType` 扩展为 `'workspace'`；本轮在 `apps/web/src/runtime/runtimeBridge.ts` 补齐双向映射：
- 读取：`sourceEntityType === 'workspace'` → 画布边端点 `workspace:<id>`
- 写回：`workspace:` 前缀边持久化为 workspace relation
- diff：workspace 端点边进 upsert/delete relation
- 契约测试新增“persists and projects workspace aggregate relation endpoints”，runtimeBridge 10/10 过

### 边界 2：ContextSnapshot 完整历史 —— ⚠️ 后端已具备，前端未接活
后端 B5 已有 `ContextSnapshotService`（create/list/compare/branch + 路由）。前端 `ContextHistoryRail` 目前只消费 `ActiveContext.recentChanges` 投影，**尚未调用** `/context-snapshots`、`/compare`、`/branch`。这是下一批真正“后端返回前端”的差距。

### 边界 3：Session/Handoff 完整历史 —— ⚠️ 后端已具备，前端未显式接
后端有 `HandoffRecord`（schema v20）+ `/projects/:id/handoffs` 路由；前端 `ContextFlowSurface` 有 `lcos-handoff-ribbon` 投影但 client 未显式接 GET/POST。

### 边界 4：Projection Layout —— ✅ 前端 localStorage，按设计无需后端
`projectionLayoutState` 已实现，FRONTEND_ONLY 定位不变。

## 5. 提交

- `3c4c721` feat(web): merge Phase 4 vNext surface reconstruction（36 文件，+2318/−588）
- `8686576` feat(web): workspace aggregate relation endpoints in runtime bridge（2 文件）

工作树干净。

## 6. 未完成 / 阻塞

- **ContextSnapshot / Handoff 全量 Client 接活**（边界 2/3）：需要 `localCoreClient` 增加 `contextSnapshots / compareSnapshot / branchSnapshot / handoffs` 方法并让 ContextHistoryRail、Handoff ribbon 跨盘使用。是否推进待 Dz 拍板。
- **E2E 跳过项**：`multi-selection can stage from bottom gutter` 因 seed 项目节点不足跳过（需真实两个节点 + Relation 的项目）。
- dev 栈为 detached 进程（Core 43121 / Bridge 43122 / Web 5173），`npm run dev:stop` 管不到；后端本轮无 local-core 代码改动，Core 无需重启。

## 7. 回滚

前端合并整体回滚：`git revert 3c4c721`；关系补强回滚：`git revert 8686576`。两者独立可回滚。
