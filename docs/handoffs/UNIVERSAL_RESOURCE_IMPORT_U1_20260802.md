# Universal Resource Import — U1 交付（单文件与 URL 零表单导入）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` Slice U1
> 状态：已完成，未提交（等待 Dz 指示）

## Decision

U1 完成：MD / TXT / JSON / YAML / Link 全部支持零表单导入；导入即生成可重建的 ResourceDescriptor（Fast Descriptor 同步、fallback 理解异步）；Web 的 Link 表单已去 purpose/description；Schema v7 已落地。

## Current evidence

- Schema：`user_version = 7`，`get schemaVersion() = 7`，新增 `resource_descriptors` 表（v7 迁移实测通过）
- Import Copy：`SUPPORTED_EXTENSIONS` 新增 `.json/.yaml/.yml`（MD/TXT/图片原有）
- Link 生成：已从 Web 前端移到 `apps/local-core/src/resources/link-document.ts`（服务端 `.link.md`，保存不依赖抓取）
- 安全：`url-security.ts` 拒绝 file://、localhost、私网/回环 IP、带凭据 URL
- Web：`LinkReferenceDialog` 只剩 url（必填）+ 可选标题/备注；`App.createLinkReference` 走 `POST /resources/import-url`

## Changed files

| 文件 | 变更 |
|---|---|
| `packages/contracts/src/resources.ts`（U0） | 合同类型（U1 使用） |
| `apps/local-core/src/metadata-repository.ts` | v7 迁移 + Descriptor CRUD（createPending / replace / get / list / markFailed） |
| `apps/local-core/src/import-copy-service.ts` | 支持 .json/.yaml/.yml |
| `apps/local-core/src/resources/universal-resource-import-service.ts` | 新建：文件/URL 统一导入 + Fast Descriptor + 异步 fallback 理解 |
| `apps/local-core/src/resources/resource-descriptor-service.ts` | 新建：Fast Descriptor / fallback 分析 |
| `apps/local-core/src/resources/link-document.ts` | 新建：服务端 .link.md 生成 |
| `apps/local-core/src/resources/url-security.ts` | 新建：SSRF 防护 |
| `apps/local-core/src/server.ts` | /imports 自动带 Descriptor；新增 import-url / list / descriptor / reanalyze 路由 |
| `apps/local-core/src/index.ts` | 导出新服务 |
| `apps/web/src/runtime/localCoreClient.ts` | importResourceUrl / resourceList / resourceDescriptor / resourceReanalyze |
| `apps/web/src/runtime/v07UiContracts.ts` | LinkReferenceInput 去 description/purpose，移除前端文档生成 |
| `apps/web/src/features/create/LinkReferenceDialog.tsx` | 去表单 |
| `apps/web/src/App.tsx` | Link 导入改走服务端 + 画布刷新 |
| 测试 | link-document 3、universal-import 8、resource-http 2、linkReference 2、v07Integration 更新、schema 断言 6→7 |

## Schema / Migration

```text
v6 → v7：新增 resource_descriptors（唯一约束 artifact_id + source_revision_id + analyzer_version）
```

仅新增表；Artifact / Revision / FileRecord 语义未改；旧库迁移实测通过（v1 fixture → v7）。

## Import flows

- 文件（MD/TXT/JSON/YAML/图片）：`POST /imports` → ImportCopy + Fast Descriptor(pending) → 异步 fallback(partial) → `POST /resources/:id/reanalyze` 可重跑
- URL：`POST /projects/:id/resources/import-url` → 校验安全 → 服务端生成 `.link.md` → ImportCopy → Descriptor（source.kind=url，normalizedUrl/domain）
- 未知/失败：保留节点，理解状态 partial/failed，不阻止导入

## Analyzer behavior

- U1 仅 Fast Descriptor（同步）与 fallback-v0（异步，内容预览 + partial 状态）
- 完整格式 Analyzer（markdown/json/yaml/skill…）归 U2

## Security

- URL：http/https only、禁 localhost/私网/回环/凭据、长度限制；单元与 HTTP 测试覆盖
- Browser 仍不提交绝对路径（沿用 FORBIDDEN_BROWSER_PATH_FIELDS）
- Descriptor 写操作仅服务端；无前端 patch 入口

## CLI / MCP

- 未变更（U2 增加 resource list/describe/read/match）

## Web behavior

- Link 表单：url 必填，标题/备注可选；不再要求 purpose/description/category/workflowStage
- 导入后画布自动刷新，节点出现；理解状态在 Descriptor 中

## Tests actually run

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 29 files / 119 tests |
| local-core unit | ✅ 24 files / 131 tests |
| domain / contracts | ✅ 5 / 4 |
| architecture | ✅ 4 files / 27 tests |
| integration | ✅ 5/5 |
| build / smoke | ✅ |
| E2E | ✅ 6/6 |

## Known limitations

- 文件夹 / ZIP / Skill 包导入未做（U3）
- 真实 Analyzer（markdown/json/yaml 结构理解）未做（U2）
- URL 元数据抓取未做（U2 link analyzer）
- ResourceMatcher / Manifest ResourceRef 未做（U4）
- Workbench 展示未做（U5）
- 异步理解队列为进程内 single-flight；Local Core 重启后 pending 记录可通过 reanalyze 手动补跑（计划允许）

## Rollback

- v7 为增量迁移：回滚 = 删除 resource_descriptors 表并改回 v6（或 revert commit）
- Web 去表单可独立 revert
- 无既有数据破坏

## Go / Stop

**STOP — U1 完成，等待评审后进入 U2（Analyzer 与 ResourceReader）。**

---

_Codex 2026-08-02，全部结果基于本次实测。_
