# Universal Resource Import — U2 交付（Analyzer 与 ResourceReader）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` Slice U2
> 状态：已完成，未提交（等待 Dz 指示）

## Decision

U2 完成：Markdown / TXT / JSON / YAML / Link / Fallback 六类 Analyzer 接入统一 Registry；ResourceReader 提供受安全边界约束的内容读取；CLI 与 MCP 新增 resource 工具；导入理解从"fallback 占位"升级为真实格式识别。

## Current evidence

- Analyzer Registry：`resources/analyzers/analyzer-registry.ts`（supports 0..1 评分，主 Analyzer + 结构 Analyzer 合并多候选）
- 格式分析：Markdown（frontmatter/H1-H2/链接/代码块 → brief/script/storyboard/feedback/skill 候选）、JSON（manifest/skill_manifest/workflow/tool_config/structured_data，安全 parse）、YAML（安全子集解析器：拒绝 anchor/alias/tag/多文档，支持嵌套 map/list）、TXT（行数/首行/预览）、Link（安全抓取：http/https、重定向逐跳校验、5s 超时、256KB 上限、不携带 Cookie；失败降级 partial）、Fallback（unknown 合法）
- 理解状态：pending → ready / partial / failed；重新分析 `POST /resources/:id/reanalyze` 走完整 Registry
- ResourceReader：`GET /resources/:id/content?path&offset&limit&format=raw|text|json_tree`，单次 ≤1MB、只读资源自身文件、拒绝路径越界、返回 contentHash/truncated
- CLI：`lcos resource list/show/read/reanalyze`（真实子进程 E2E 测试通过）
- MCP：`lcos_resource_list / lcos_resource_describe / lcos_resource_read` 薄委托

## Changed files

| 文件 | 变更 |
|---|---|
| `resources/analyzers/analyzer-registry.ts` | 新建 |
| `resources/analyzers/markdown-analyzer.ts` | 新建 |
| `resources/analyzers/text-analyzer.ts` | 新建 |
| `resources/analyzers/json-analyzer.ts` | 新建 |
| `resources/analyzers/yaml-analyzer.ts` | 新建（安全子集解析） |
| `resources/analyzers/link-analyzer.ts` | 新建（安全抓取 + 降级） |
| `resources/analyzers/fallback-analyzer.ts` | 新建（从 U1 迁移） |
| `resources/resource-reader.ts` | 新建 |
| `resources/resource-descriptor-service.ts` | analyzeResource 走 Registry |
| `resources/universal-resource-import-service.ts` | reanalyze 全分析管线；内容读取 512KB 上限 |
| `server.ts` | content 路由 |
| `tools/lcos-agent/cli.mjs` | resource 命令组 |
| `tools/lcos-agent/mcp-server.mjs` | 3 个 resource 工具 |
| `index.ts` | 导出 |
| 测试 | analyzers 7、reader 3、cli 1（真实子进程）、U1 测试更新 |

## Schema / Migration

无新增迁移（复用 v7 `resource_descriptors`）。

## Import flows / Analyzer behavior

- 导入：Fast Descriptor（pending）→ 异步理解（Registry）→ ready/partial；reanalyze 可重跑
- YAML：只接受安全子集；别名/标签/多文档 → invalid_yaml（partial），不执行任何反序列化
- Link：保存永远成功；抓取失败 → partial + 警告，Agent 可经连接器/内置浏览器读取
- 所有能力推断带 evidence；`unknown` 是合法结果；confidence ∈ [0,1]

## Security

- 抓取：仅 http/https；拒绝 localhost/私网/回环/凭据；重定向 ≤5 且每跳重新校验；超时 5s；大小 256KB
- 读取：只能读资源自身文件；目录资源（U3 后）只读 manifest 内文件；拒绝路径穿越；字节上限
- 无新依赖（YAML 为自研安全子集解析器）

## CLI / MCP

- CLI 通过 Local Core API（不直连 SQLite）；真实子进程测试覆盖 list/read/show
- MCP 工具为薄委托，不复制 Analyzer/Matcher 逻辑

## Tests actually run

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 29 files / 119 tests |
| local-core unit | ✅ 27 files / 143 tests |
| domain / contracts | ✅ 5 / 4 |
| architecture | ✅ 27 |
| integration | ✅ 5 |
| build / smoke | ✅ |
| E2E | ✅ 6/6 |

## Known limitations

- 文件夹 / ZIP / Skill 包导入（U3）未做；目录资源读取（manifest 约束）随之
- ResourceMatcher / ContextManifest ResourceRef（U4）未做
- Workbench 展示（U5）未做
- YAML 为安全子集解析器：复杂 YAML（多文档、anchor、自定义 tag、流式集合如 `[a, b]` 中的嵌套 map）会被标 invalid/partial；JSON/YAML 完整结构分析未做（可用性足够，保守优先）
- Link 抓取不做正文理解，只取 title/description 元数据

## Rollback

- 新增代码与测试均可独立 revert；无 Schema 变更、无数据破坏

## Go / Stop

**STOP — U2 交付点。** 下一步 **U3（文件夹 / ZIP / Skill 包导入 + 安全排除 + Skill Package Analyzer）**，或按 Dz 调整顺序。

---

_Codex 2026-08-02，全部结果基于本次实测。_
