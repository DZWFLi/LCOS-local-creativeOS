# Universal Resource Import — U0 Preflight 审计

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` 第 0 节（开工前先确认）
> 基线：`codex/mvp-fast-build @ 3a4a9fd`（工作区含未提交的 Project Create / Source Gate 批次，均为本开发线自有改动）

## 1. Git 状态

```text
branch: codex/mvp-fast-build
HEAD:   3a4a9fda6abe553f159d76b81b5f97d244292327
status: 工作区有未提交改动（README、local-core src/tests、web src/tests、E2E、docs）
```

未提交内容均为近期已实测通过的 Project Create / Runtime Source Gate / E2E 隔离批次，与本任务不冲突。

## 2. 当前前端哪些表单要求 purpose / description

| 位置 | 字段 | 是否必填 | 备注 |
|---|---|---|---|
| `apps/web/src/features/create/LinkReferenceDialog.tsx` | url / title / description / purpose | url、title 必填；description、purpose 可选但表单常驻 | 标题必填；"内容说明/项目用途"为可选文本 |
| `apps/web/src/runtime/v07UiContracts.ts` `LinkReferenceInput` | description / purpose | 类型必填（可空字符串） | `.link.md` 生成时写入文档体 |
| `apps/web/tests/linkReference.test.ts` | description / purpose | — | 已验证空字符串默认值 |

未发现 `category / workflowStage / usage / expectedOutput` 表单字段（`WorkspaceDialog`、`ScopeCreateDialog` 中的 description 是 UI 选项说明，不是导入表单）。

## 3. 当前 Skill / Link 入口实际文件路径

- Link 入口：`apps/web/src/features/create/LinkReferenceDialog.tsx` → `apps/web/src/App.tsx:914 createLinkReference` → `apps/web/src/runtime/v07UiContracts.ts:34 createLinkReferenceDocument`
- Skill 入口：**不存在独立 Skill 导入入口**（Skill 目前只能作为本地文件拖入 Import Copy 或由 Agent Skill 系统管理）。这正是本改造要补的。
- 文件拖入入口：`apps/web/src/App.tsx:837` 附近 `dropFiles → bridgeRef.current.importCopy`（Canvas Drop）。

## 4. 当前 Import Copy API 与 Service 路径

- HTTP：`POST /api/local-core/v1/projects/:projectId/imports`（`apps/local-core/src/server.ts:604-690`）
- Service：`apps/local-core/src/import-copy-service.ts`（`ImportCopyService.importCopy`）
- 客户端：`apps/web/src/runtime/localCoreClient.ts:360 importCopy`（FormData：file + importRequestId + scopeId + position.x/y + sourceKind）
- 幂等：`importRequestId` 冲突且内容/位置不同 → `ImportCopyConflictError` → 409
- 安全：`FORBIDDEN_BROWSER_PATH_FIELDS`（server.ts:44）拒绝浏览器提交绝对路径
- 写入目标：`<Project Root>/imports/`

## 5. 当前 .link.md 创建逻辑路径

当前为**前端生成文档 → 伪装成文件走 Import Copy**：

```text
LinkReferenceDialog
→ createLinkReferenceDocument（v07UiContracts.ts）
→ new File(markdown, "<slug>.link.md")
→ App.createLinkReference → dropFiles → importCopy
```

`.link.md` 内容含 frontmatter：`sourceKind / provider / resourceType / url / title / accessMode`，正文含 description 与 `## Project purpose`。

**与本计划差异**：GPT 方案要求链接保存与元数据抓取解耦（保存不依赖抓取成功），并新增 `import-url` 路由；当前实现是"纯前端生成 + 文件导入"，没有服务端 URL 校验/规范化/抓取。U1 需要把 Link 收口到服务端资源导入。

## 6. 当前 Artifact / Revision / FileRecord 的正式创建 Service

- 唯一正式创建路径：`ImportCopyService`（`apps/local-core/src/import-copy-service.ts`）→ `metadata-repository.save()` 原子登记 FileRecord / Artifact / Initial Revision / ArtifactView。
- Repository：`apps/local-core/src/metadata-repository.ts`（`save`、`createProject`、mutation API）。
- 无其他平行创建入口；`Project Create`（近期新增）只建 Project + root Scope + 默认 Workspace，不建资源。

## 7. 当前 Schema Version

```text
schemaVersion = 6
迁移链：#migrate_001 → (002→003→004→005→006)
get schemaVersion() 返回 6（metadata-repository.ts:1611）
```

本计划的 vNext = **7**（新增 `resource_descriptors` 表；不修改 Artifact/Revision 核心语义）。

## 8. 当前 CLI / MCP 入口

- CLI：`tools/lcos-agent/cli.mjs`（`npm run lcos -- ...`）——现有 `task claim/start/submit` 等 Bridge 子命令；**无 resource / canvas 子命令**。
- MCP：`tools/lcos-agent/mcp-server.mjs`——现有 14 个工具：
  `open_lcos / list_lcos_projects / get_lcos_project / get_lcos_active_context / build_lcos_context_manifest / list_lcos_runs / get_lcos_run / sync_lcos_run / claim_lcos_task / start_lcos_task / get_lcos_task / get_lcos_task_by_run / submit_lcos_result / cancel_lcos_task`
  **无 resource 工具**。
- Skill：`packages/skills/lcos-project-context/SKILL.md`（需随 CLI/MCP 扩展更新）。

## 9. 当前 ContextManifest 版本

```text
schemaVersion: 0
builderVersion: '0.1.0'（context-manifest-service.ts:24）
```

Manifest 从 Project Truth 构建、不可变、含 renderedManifestHash；尚无 Resource Ref 概念。本计划将新增 `ManifestResourceRefV0` 可选段（不改既有 immutable schema）。

## 10. Legacy 字段映射表

| 旧字段 | 出现位置 | 处理 |
|---|---|---|
| `description`（Link） | LinkReferenceDialog / v07UiContracts / linkReference.test.ts | 新写路径不再要求；保留读取，映射到 `userAnnotation.note` |
| `purpose`（Link） | 同上 | 同上，映射到 `userAnnotation.note` 或 legacyLabels |
| `category / workflowStage / usage / expectedOutput` | 未发现 | 无需迁移，新写路径禁止引入 |

兼容策略：一个迁移 Slice 内保留旧字段读取，不参与唯一分类；新写路径不生成。

## 11. 与现有路由/服务的衔接结论

- 新 `resources` 路由作为 **Application Service 委托层**，复用 Import Copy / Trusted Source / Link 底层，不复制 FileRecord / Artifact 创建逻辑（遵循 GPT 计划 §13）。
- 文件夹 / ZIP / 目录导入、安全排除、SSRF / ZIP 穿越 / symlink 防护为新增能力（U3）。
- Analyzer / Matcher / Descriptor 为新增派生层（U2 / U4），不修改 Artifact Domain。

---

_U0 Preflight 完成；Contracts 与 ADR 见同批次交付。_
