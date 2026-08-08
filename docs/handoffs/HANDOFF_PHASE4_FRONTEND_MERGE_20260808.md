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

### 边界 2：ContextSnapshot 完整历史 —— ✅ 已接活（2026-08-08 补充）
后端 B5 `ContextSnapshotService`（create/list/compare/branch + 路由）此前已具备；本轮补齐前端调用链：
- `packages/contracts` 新增 `ContextSnapshotRefsV1 / SnapshotCompareResultV1 / BranchSnapshotResultV1`，local-core service 改为从 contracts 导入（消除重复定义）
- `localCoreClient` 新增 `listContextSnapshots / createContextSnapshot / compareContextSnapshots / branchContextSnapshot`
- `historyProjection.ts` 把 Checkpoint 投影成历史条目（objectIds 取 focusedViewIds，兜底 artifactIds）
- `ContextHistoryRail` 改为消费真实快照列表（有快照时不再用 recentChanges 内存投影）；“从这里建现场”调 branch API、“对比当前”调 compare API（真实快照条目）

### 边界 3：Session/Handoff 完整历史 —— ✅ 已接活（2026-08-08 补充）
- `packages/contracts` re-export `HandoffRecord / HandoffResumeMode / HandoffArtifactRef`
- `localCoreClient` 新增 `listHandoffs / createHandoff / deleteHandoff`
- `historyProjection.ts` 把 HandoffRecord 投影成 ribbon 条目（fromProvider/toProvider/title）
- `lcos-handoff-ribbon` 与历史栏交接列表改为读后端记录（有记录时不再用画布边推导兜底，画布边推导保留为空态 fallback）

### 边界 4：Projection Layout —— ✅ 前端 localStorage，按设计无需后端
`projectionLayoutState` 已实现，FRONTEND_ONLY 定位不变。

## 5. 提交

- `3c4c721` feat(web): merge Phase 4 vNext surface reconstruction（36 文件，+2318/−588）
- `8686576` feat(web): workspace aggregate relation endpoints in runtime bridge（2 文件）

工作树干净。

## 6. 未完成 / 阻塞

- **E2E 跳过项**：`multi-selection can stage from bottom gutter` 因 seed 项目节点不足跳过（需真实两个节点 + Relation 的项目）。
- dev 栈为 detached 进程（Core 43121 / Bridge 43122 / Web 5173），`npm run dev:stop` 管不到；后端本轮无 local-core 代码改动，Core 无需重启。

## 8. 接活验证证据（2026-08-08）

- 全量 `npm run check:fast` 绿：web 140/140（新增 historyProjection 6 + runtimeBridge 10）、core 258/258、架构 70/70、build 过
- 真实 HTTP（Core 43121，disposable-mvp-sample）：
  - 创建快照 A（workspace-brief-script）→ 2 artifacts + 2 views 冻结
  - 创建快照 B → compare A↔B：kept=2
  - branch A → 新 collection scope + 2 views
  - list（workspace 过滤 3 条 / 全部 4 条）；创建 Handoff（Codex → WorkBuddy）成功
- 真实浏览器（5173 agent=codex）：上下文 surface 历史栏显示“MVP sample start / Brief / Script / Phase4 验收基线 A / Phase4 验收基线 B”，交接栏显示 Codex → WorkBuddy
- 说明：初次测试传 `ws-main` 触发 FK 失败，实为测试参数错误（seed 项目真实 workspace id 是 workspace-brief-script 等），非代码缺陷

## 7. 回滚

前端合并整体回滚：`git revert 3c4c721`；关系补强回滚：`git revert 8686576`。两者独立可回滚。
