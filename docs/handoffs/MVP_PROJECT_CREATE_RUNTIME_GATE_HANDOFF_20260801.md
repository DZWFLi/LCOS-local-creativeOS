# MVP 正式 Project Create + Runtime Source Gate + E2E 隔离（2026-08-01）

> 读者：Dz（决策人）
> 作者：Codex
> 分支：`codex/mvp-fast-build`（未提交，等待 Dz 指示）
> 目的：把"用户能建自己的真实项目"打通，消除 Runtime 模式静默降级，并让 E2E 不再污染开发库。

---

## 1. 任务摘要

按 Dz 指示继续推进 MVP 开发（不做表面缓解），本轮完成三项：

1. **正式 Project Create**：Local Core 新增 `POST /projects` + 事务建库（Project + root Scope + 默认 Workspace）；Web `createProject` 从纯内存改为真实 API + Runtime 加载。
2. **Runtime Source Gate**：用户显式请求的项目在 catalog 缺失时，显式报错回到项目列表，绝不静默回退 Sample / Fixture；空 catalog 与 Core 离线仍为明确标注的 Demo 模式。
3. **E2E 独立临时数据库**：E2E 使用 `LOCAL_CORE_DB_PATH` 指向临时目录、禁用 MVP Sample、跑完自动清理；开发库不再被测试污染。

## 2. 变更原因

- 用户无法创建自己的项目：`createProject` 只写 React 内存，刷新即丢；项目 ID 仅 `disposable-mvp-sample` + `project-huaxin` 硬编码。产品"项目容器"地基不真实。
- Runtime 模式下项目缺失会静默打开 Sample 或 Fixture，用户误以为在看自己的数据（Buddy 与 Codex 均点名）。
- E2E 直接复用 `apps/local-core/.data/phase2.sqlite`，用例不隔离（Buddy safe-delete 兼容的"手动清理"是懒政）。

## 3. 变更前 / 变更后流程图

### Project Create

```text
变更前：
Web createProject → React state + 前端缓存 → toast"已创建" → 刷新丢失

变更后：
Web createProject → POST /projects（name/rootPath）
  → validateProjectRoot（必须存在、可读、目录）
  → 事务：Project + root Scope + 默认 Workspace（SQLite，graphVersion=1）
  → 201 返回 ProjectCatalogEntry
  → Web 重建 RuntimeBridge → loadProject → 应用 Runtime state → 打开 Canvas
```

### Runtime Source Gate

```text
变更前：
catalog → find(requested) ?? find(sample) ?? first ?? demo（静默降级）

变更后：
catalog → selectRuntimeProject：
  requested 存在 → 打开 requested
  requested 缺失 → 显式错误 + 回到项目列表（toast 可见，不使用 Demo 数据）
  未指定且 sample 存在 → sample（bootstrap）
  未指定且 catalog 有项目 → 第一个
  空 catalog → 明确标注的 Demo 模式
  Core 离线 → 明确标注的 Demo 模式
```

## 4. 用户操作变化

- 新建项目对话框照旧，但成功后项目**真实写入 Local Core**，刷新/重启仍在 catalog。
- 指定不存在的项目（`?project=xxx`）时：回到项目列表并看到"项目不存在"提示，不再打开 Sample。
- 其余交互零变化。

## 5. 数据流变化

- 新增 HTTP 合同：`POST /api/local-core/v1/projects`，body `{ name, rootPath }`，成功 201 `ProjectCatalogEntry`；失败 400（参数）/ 404（root 不存在）/ 409（重复）。
- Web 客户端新增 `createProject` 方法；项目列表数据源从 Fixture 目录切换为 Runtime catalog（缺失请求时同样使用真实 catalog）。
- 无 Schema 变更（复用 projects/scopes/workspaces 表，schemaVersion 保持 6）。

## 6. 影响模块

| 模块 | 变更 |
|------|------|
| `apps/local-core/src/metadata-repository.ts` | 新增 `createProject`（事务、幂等冲突、重启恢复） |
| `apps/local-core/src/server.ts` | 新增 `POST /projects` 路由 + `createProjectId` |
| `apps/web/src/runtime/localCoreClient.ts` | 新增 `createProject` 客户端方法 |
| `apps/web/src/runtime/runtimeProjectSelection.ts` | 新增 Source Gate 纯函数（可单测） |
| `apps/web/src/App.tsx` | 移除 `project-huaxin` 硬编码；boot 使用 Source Gate；createProject 接真实 API；关闭项目页显示 toast |
| `tests/e2e/golden-path.spec.ts` | 临时 DB + 新增 2 个 E2E 用例 |
| `playwright.config.ts` | `reuseExistingServer: false`（杜绝残留服务器污染） |

## 7. 测试结果（实测）

| 阶段 | 结果 |
|------|------|
| lint / typecheck / build / smoke | ✅ 全过 |
| web unit | ✅ 29 files / **119 tests**（+6：Source Gate 5、createProject 客户端 1） |
| local-core unit | ✅ 21 files / **119 tests**（+4：project-create） |
| domain / contracts | ✅ 5 / 4 |
| architecture | ✅ 4 files / 27 tests |
| integration | ✅ 5/5 |
| E2E | ✅ **6/6**（新增：真实建项目并打开、缺失项目显式报错） |
| 开发库隔离 | ✅ 跑完 E2E 后 `phase2.sqlite` mtime 未变 |

关键 E2E 证据：

```text
✓ Browser loads Runtime data from SQLite via Proxy
✓ nonexistent project returns 404
✓ Mutation save verified via Node HTTP golden path script
✓ Restart Local Core → reload page → data persists
✓ creates a real project through the Vite proxy and opens it   ← 新增
✓ requested missing project shows explicit error instead of silent demo fallback  ← 新增
```

## 8. 风险与未完成

- `POST /projects` 目前要求 rootPath 已存在且可读（真实目录校验）；"创建时自动建目录"未做，属有意边界。
- 空 catalog 首启仍进入 Demo 模式（明确标注）；"无项目时引导新建"的空状态可后续优化，不阻塞收口。
- 真实 WorkBuddy 闭环在新建项目上的完整回归（Run → Return → Accept）需 WorkBuddy 在线时复测。
- 未提交、未 Push；`project-huaxin` fixture 数据仍在 qa-fixtures（仅 Demo 用，入口已移除）。

## 9. 回滚说明

- 无 Schema 迁移、无依赖变更、无数据格式变化。
- 回滚 = revert 本批次 commit；已有 SQLite 数据兼容（新增表结构未动）。
- E2E 临时 DB 方案可独立 revert（`golden-path.spec.ts` + `playwright.config.ts`）。

---

_Codex 2026-08-01 生成，全部结果基于本次实测。_
