# MVP 1.0 最终集中质量链与交付报告（2026-07-31）

> 读者：Dz（决策人）
> 作者：Codex（接管方）
> 依据：`CODEX_START_HERE.md`、`MVP_V1_EXECUTION_README.md`（Slice 0–5 完成后的最终集中验收）
> 状态：质量链全绿，E2E 有 2 条过期断言待决策，尚未提交

---

## 1. 任务摘要

按 `CODEX_START_HERE.md` 流程接手 `codex/mvp-fast-build` 分支，完成：

1. 阅读 README / AGENTS / PRD V1.2 冻结稿 / UI Spec v0.2 冻结稿 / 最新 Handoff / 7-31 UI 接入审计。
2. 检查仓库与 Git 状态。
3. 执行最终集中质量链（lint → typecheck → unit → build → integration → architecture → smoke → E2E）。
4. 修复基线中发现的两处 schema 版本断言漂移。
5. 输出本交付报告；按 `MVP_V1_EXECUTION_README.md` 不自动提交、不 Push。

## 2. 实际范围

只做基线验证与最小修复，未开始新功能开发：

- 未改动任何产品代码、Runtime 合同、Schema 或 UI。
- 修改了 2 个测试文件的常量断言（见 §5）。
- 验证 Porcelain Studio 2.0 接线点（审计 §7 要求）。

## 3. 仓库与分支状态

| 项 | 值 |
|----|----|
| Worktree | `E:\Codex 项目\OS开发\.worktrees\mvp-fast-build` |
| Branch | `codex/mvp-fast-build` |
| HEAD | `820273f docs: update UI audit with successful fix record` |
| 上游关键提交 | `2d6f27b feat: Porcelain Studio 2.0 完整接线` |
| 工作区 | 干净（除本报告与两处测试断言修改） |
| 主仓库分支 | `fix/repo-worktree-location`（工作树入口；本分支为真实开发线） |

```bash
git status   # 2 modified: 测试常量（见 §5）
git branch   # codex/mvp-fast-build
git log --oneline -10
git diff --check   # 无问题
```

## 4. 文档核对

- `README.md` / `AGENTS.md`：已读，无核心冲突。
- PRD V1.2 冻结决策回写版（docx）：已读，八项冻结决策与 UI Spec v0.2 一致。
- UI & Interaction Spec v0.2 冻结稿（docx）：已读，Workspace=Semantic Viewport、单 Canvas、Overlay/Inspector 栈、LOD、Porcelain 视觉均为冻结结论。
- 最新 Handoff：`MVP_STAGE7_IMPORT_BRIDGE_GATE_2026-07-29.md`（Stage 7B 决策挂起）。
- 7-31 审计：`docs/audit/BUDDY_UI_PACKAGE_INTEGRATION_AUDIT_20260731.md`（Porcelain 接线已由 Buddy 二次修复，commit `2d6f27b`）。
- 执行 README：`handoff-packages/.../MVP_V1_EXECUTION_README.md`（最终完成线 = 五个纵向 Slice；下一步 = 集中质量链 + 交付报告，等 Dz 明确要求后提交）。

## 5. 修改文件

基线检查发现 schema v6 迁移已在源码生效，但两处测试仍断言 v5（7-31 备份/robocopy 同步只覆盖了 `apps/local-core/src`、`packages/*`、`apps/web/*`，未覆盖 `apps/local-core/tests` 与 `tests/architecture`）：

| 文件 | 修改 |
|------|------|
| `apps/local-core/tests/metadata-repository.test.ts` | `SCHEMA_VERSION` 5 → 6（与备份目录一致） |
| `tests/architecture/data-spine.test.ts` | `expect(loaded!.schemaVersion).toBe(5)` → `toBe(6)` |

证据：备份目录 `_mvp-fast-build-bak/apps/local-core/tests/metadata-repository.test.ts` 中 `SCHEMA_VERSION = 6`；`apps/local-core/src/metadata-repository.ts` 的 `get schemaVersion()` 返回 6 且包含 `#migrate_006_from_v5`。

## 6. 集中质量链结果

| 阶段 | 命令 | 结果 |
|------|------|------|
| lint | `npm run lint` | ✅ PASS（仅存量 warning：App.tsx unused vars / hooks deps、import-copy 正则） |
| typecheck | `npm run typecheck` | ✅ PASS（web / local-core / domain / contracts 4/4） |
| unit test | `npm run test` | ✅ PASS：web 28 files / **113 tests**；local-core 11 files / **76 tests**；domain 5；contracts 4（合计 **198**） |
| integration | `npm run test:integration` | ✅ PASS：1 file / 5 tests |
| architecture | `npm run test:architecture` | ✅ PASS：3 files / **24 tests**（原 1 个失败 = §5 的 v5/v6 断言，已修） |
| build | `npm run build` | ✅ PASS：CSS 235.61 kB（含 porcelain）、JS 378.72 kB，1823 modules |
| smoke | `npm run smoke` | ✅ PASS：2 built assets，React root 存在 |
| e2e | `npm run test:e2e` | ⚠️ 2 passed / 2 failed（见 §7，断言过期，非产品回归） |

## 7. E2E 详情与结论

`tests/e2e/golden-path.spec.ts`（Phase 2.5 时代的浏览器金路径）：

- ✅ `nonexistent project returns 404`（Vite Proxy → Local Core 链路真实工作）
- ✅ `Mutation save verified via Node HTTP golden path script`
- ❌ `Browser loads Runtime data from SQLite via Proxy`：等不到 `.runtime-badge`
- ❌ `Restart Local Core → reload page → data persists`：同上，Core 重启本身成功

根因：当前 v0.7/Porcelain App Shell 不再渲染 `.runtime-badge`（class 只剩 CSS 定义，无组件使用）；Runtime 状态现由 `RuntimeDiagnosticsPage`（`data-testid="runtime-diagnostics"` + `SourceBadge origin="runtime"`）呈现。App 启动、Proxy、Core 重启、数据持久化均正常。这是测试合同过期，不是产品回归。

待决策：更新 E2E 断言指向当前 Runtime 指示器（推荐），或在 App Shell 恢复 `.runtime-badge` 元素。未获批准前不改。

## 8. Porcelain Studio 2.0 接线验证（审计 §7 复核）

| 检查点 | 结果 |
|--------|------|
| `App.tsx` 含 `porcelain-studio-v2` | ✅ 1 处 |
| `main.tsx` import `./porcelain-studio.css` | ✅ 1 处 |
| `model.ts` nodeMeta 七色 token | ✅ 7 处命中 |
| `porcelain-studio.css` | ✅ 存在（60KB） |
| root + web 版本 | ✅ 0.7.3 / 0.7.3 |
| Runtime 合同（`runtimeBridge.ts` / `localCoreClient.ts`） | ✅ 与 porcelain 包/备份规范化内容完全一致（仅 CRLF/LF 差异） |

## 9. 风险与未完成

1. **E2E 断言过期**（§7）：2 条 `.runtime-badge` 断言需决策更新或恢复 UI 元素。
2. **Stage 7B 决策挂起**：`MVP_STAGE7_IMPORT_AND_BRIDGE_REALITY_GATE_2026-07-29` 要求决定临时拖放导入的收口方式（保留临时 / dev-only trusted helper / 等原生授权）。
3. **Bridge 红线未解除**：`E:\Buddy项目\ai-bridge` 无可靠 Git 基线；Slice 4 硬门未通过前不得接线。MVP 已用 `tools/ai-bridge-runtime/` 提纯内核完成真实闭环（E2E `run-d190abd4-...` 证据在案）。
4. **存量 lint warning**：App.tsx 未使用变量与 hooks deps（不影响构建）。
5. **localStorage**：`prototypeStorage.ts` / `projectNavigation.ts` 仍用于原型状态与项目导航；按 AGENTS 仅应保存可丢失 UI 偏好，正式数据应走 Local Core（当前 MVP 的 Project Truth 在 Local Core SQLite，未违反红线）。
6. **手工浏览器验收**：本报告基于自动化；审计中记录的浏览器实测（Core 43121 / Web 5173）为最近一次人工验证，未在本轮重复。
7. 未运行：`test:lcos-mcp-e2e`（需 `LCOS_LIGHT_BRIDGE_PYTHON` 环境，且 Slice C 已有真实 E2E 证据）。

## 10. 下一步（按执行 README）

1. 等待 Dz 对「提交 / 不提交」与「E2E 断言更新」的明确指示；不自动 Push、不建 Tag。
2. 若批准，建议顺序：更新 E2E 断言 → 重跑 `npm run test:e2e` → 提交两处测试修复 + 报告 → 再讨论 Stage 7B 与回主开发线。

## 11. 回滚说明

- 两处测试修改为单行断言，回滚 = revert 对应 commit 或手工改回 `5`。
- 未改产品代码、未改 Schema、未引入依赖；无迁移与数据影响。
- 若后续提交，本报告与测试修改同批提交，可独立 revert。

---

_Codex 2026-07-31 生成，如实记录（Mock / 占位 / 未验证均已标注）_
