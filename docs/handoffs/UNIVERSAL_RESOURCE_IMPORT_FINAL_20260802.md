# Universal Resource Import — 最终收口报告（U0–U5）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md`（§19 切片、§21 DoD、§22 汇报格式、§23 最终验收句）
> 状态：全部完成，未提交（等待 Dz 指示）

## Decision

GPT 方案 U0–U5 全部实施完成：零表单通用资源导入（文件/文件夹/ZIP/链接）、ResourceDescriptor 可重建理解层、安全边界（SSRF/ZIP 穿越/symlink/敏感文件）、CLI/MCP 双侧接入、Run 时 ResourceMatcher 与 Manifest ResourceRef、RuntimeInputPack 物化、Web 零表单入口与理解展示。全部质量链绿，E2E 7/7。

## §21 DoD 核对

| DoD | 证据 |
|---|---|
| Skill/Link 导入不再要求目的/简介/分类/阶段 | LinkReferenceDialog 只剩 url+可选标题/备注；导入请求无 purpose/description/category/workflowStage（contracts 冻结） |
| MD/TXT/JSON/YAML 零表单导入 | Import Copy 扩展 + 测试 |
| 未知格式以 metadata 节点导入 | fallback partial；导入永不因理解失败而失败 |
| Skill 文件夹以单节点导入 | ResourcePackageService + manifest |
| Descriptor 多候选/证据/置信度/unknown | Analyzer Registry + detectedKinds evidence；unknown 合法 |
| Descriptor 可重建，不篡改 Artifact/Revision | replaceDerivedDescriptor 独立表；reanalyze |
| Agent 经 CLI/MCP 读 Descriptor 与原文 | resource list/show/read + MCP 3 工具（真实子进程测试） |
| ResourceMatcher Run 时给候选 | POST /resources/match + createRun 自动匹配 |
| ContextManifest 只记实际采用资源 | resourceRefs 可选段（仅匹配结果） |
| 未授权 Skill 可读不可执行 | trust.level + requiresApproval；分析只读 |
| URL 抓取失败不影响保存 | link 保存独立于抓取；partial 降级 |
| SSRF/ZIP 穿越/symlink/路径越界测试通过 | url-security、zip-reader、resource-reader 测试 |
| Browser 不提交绝对路径 | FORBIDDEN_BROWSER_PATH_FIELDS + 资源合同无 path 字段 |
| 刷新/Core 重启后 Resource/Descriptor 恢复 | E2E 7/7 + runtime-persistence |
| 原 purpose/description 新写路径已删除 | v07UiContracts 移除；link-document 服务端化 |

## §23 最终验收句对照

> 用户把 Markdown、JSON、YAML、普通文件、Skill 文件夹或链接直接放进 LCOS，不需要填写用途和简介；Local Core 安全注册资源、生成可重建 ResourceDescriptor，并允许 Buddy / Codex 通过同一套 CLI/MCP 先读描述、再按需读原文；匹配发生在 Run 时，用户仍掌握启用、执行与版本接纳的最终决定权。

**已满足。**

## 全量质量链（最终）

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 121 |
| local-core unit | ✅ 164 |
| domain / contracts | ✅ 5 / 4 |
| architecture / integration | ✅ 27 / 5 |
| build / smoke | ✅ |
| E2E | ✅ 7/7 |

## 完整变更面（U0–U5）

### 合同
- `packages/contracts/src/resources.ts`（新增）：ResourceSourceV0 / ImportResourceRequestV1 / ImportResourceResultV1 / ResourceDescriptorV0 / ResourceMatchQueryV0 / ResourceMatchV0 / ManifestResourceRefV0
- `packages/contracts/src/index.ts`：导出 + BuildContextManifestV0Input.resourceRefs

### Local Core 后端
- `metadata-repository.ts`：v7 迁移（resource_descriptors）+ Descriptor CRUD
- `import-copy-service.ts`：JSON/YAML 支持
- `resources/`（新增目录）：universal-resource-import-service、resource-descriptor-service、resource-package-service、resource-reader、resource-matcher、link-document、url-security、zip-reader、analyzers/（registry、markdown、text、json、yaml、skill-package、link、fallback）
- `context-manifest-service.ts`：resourceRefs
- `runtime-application-service.ts`：Run 时匹配
- `runtime-adapter.ts`：RuntimeInputPack resourceRefs/resourceFiles
- `server.ts`：import-url / import-directory / import-archive / resources 列表 / descriptor / content / reanalyze / match 路由；/imports 附带 Descriptor

### 工具
- `tools/lcos-agent/cli.mjs`：resource list/show/read/reanalyze/import/match
- `tools/lcos-agent/mcp-server.mjs`：lcos_resource_list/describe/read/match
- `tools/lcos-agent/lib/client.mjs`：FormData 支持

### Web 前端
- `features/resources/UniversalImportPanel.tsx`、`ResourceDetailDialog.tsx`（新增）
- `runtime/localCoreClient.ts`：importResourceUrl/Directory/Archive、resourceList/Descriptor/Reanalyze/Read
- `App.tsx`：零表单链接、通用导入面板、资源状态轮询、资源详情
- `v07UiContracts.ts`、`LinkReferenceDialog.tsx`：去表单

### 测试（新增 46 个）
- local-core：link-document 3、universal-import 8、zip-reader 5、package-service 4、skill-analyzer 2、package-http 2、reader 3、analyzers 7、matcher 5、match-http 1、runtime-pack 1、cli 2、resource-http 2（+ schema 断言更新）
- web：localCoreClient +7（createProject/importUrl/dir/archive…）、linkReference 2、v07Integration 更新
- E2E：+2（真实建项目、缺失项目报错、U5 零表单+持久化）

## 已知边界

- 无向量库（确定性匹配）；pending 资源需 reanalyze 后参与匹配
- Web 目录选择用 webkitdirectory；完整 Workbench 五态面板后置
- 飞书正文授权读取不在本方案范围

## Rollback

按 Slice revert；v7 为增量迁移；无既有数据破坏。

---

_Codex 2026-08-02，全部结论基于本次实测。_
