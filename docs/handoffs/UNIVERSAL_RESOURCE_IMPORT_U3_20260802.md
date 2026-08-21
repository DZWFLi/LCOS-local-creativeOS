# Universal Resource Import — U3 交付（文件夹 / ZIP / Skill 包）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` Slice U3
> 状态：已完成，未提交（等待 Dz 指示）

## Decision

U3 完成：文件夹 / ZIP 以"一个 Resource 节点"安全导入（写 `resource-manifest.json`、过滤敏感内容、限制深度/大小、拒绝 symlink 与路径穿越）；Skill Package Analyzer 识别 SKILL.md 包并输出名称/说明/入口/依赖线索；CLI 支持 `resource import <path-or-url>`。

## Current evidence

- `resources/zip-reader.ts`：零依赖安全 ZIP 解包（EOCD + central directory + local header + zlib inflateRaw），拒绝：ZIP64、加密、非 stored/deflate 方法、symlink entry、路径穿越/绝对路径、超过 500 项 / 单文件 10MB / 总计 50MB
- `resources/resource-package-service.ts`：目录导入 → `<Project>/imports/resources/<resourceId>/source/` + `resource-manifest.json`（schemaVersion 0，无绝对路径）→ 单 FileRecord/Artifact/Revision/View；幂等重放；过滤 `.git/node_modules/.venv/__pycache__/dist/build/.cache/.env/*.key/*.pem/.p12/.pfx/credentials.json` 等；深度 ≤8、文件 ≤200、单文件 ≤10MB、总 ≤50MB
- `analyzers/skill-package-analyzer.ts`：SKILL.md（或 README）frontmatter name/description/inputs/outputs，entrypoints（SKILL.md/README/mcp*.json/scripts/*），依赖文件线索；无 SKILL.md → `unknown_package` partial；只读分析，绝不安装/执行
- ResourceReader：目录资源按 manifest 白名单读文件，越界拒绝
- HTTP：`POST /resources/import-directory`（base64 JSON）、`POST /resources/import-archive`（multipart）
- CLI：`lcos resource import <project-id> <dir|zip|url> [--name]`（目录递归收集、ZIP FormData、URL 走 import-url；真实子进程测试通过）

## Changed files

| 文件 | 变更 |
|---|---|
| `resources/zip-reader.ts` | 新建 |
| `resources/resource-package-service.ts` | 新建 |
| `resources/analyzers/skill-package-analyzer.ts` | 新建 |
| `resources/resource-reader.ts` | 目录资源 manifest 白名单读取 |
| `resources/universal-resource-import-service.ts` | reanalyze 支持目录 readFile（manifest 受限读取） |
| `resources/analyzers/analyzer-registry.ts` | input 增加 readFile 回调 |
| `server.ts` | import-directory / import-archive 路由 |
| `tools/lcos-agent/cli.mjs` | resource import |
| `tools/lcos-agent/lib/client.mjs` | FormData 支持 |
| `index.ts` | 导出 |
| 测试 | zip-reader 5、package-service 4、skill-analyzer 2、package-http 2、cli import 1 |

## Schema / Migration

无新增（沿用 v7）。

## Import flows

```text
目录/ZIP → 安全收集（忽略/限制/拒绝）→ source/ 落盘 → resource-manifest.json
→ 单节点注册 → Fast Descriptor(pending) → SkillPackageAnalyzer → ready/partial
```

## Security

- ZIP：路径穿越与绝对路径丢弃、symlink 拒绝、加密拒绝、解压炸弹限制（单文件 10MB / 总计 50MB）、ZIP64 拒绝
- 目录：敏感文件/目录过滤、深度/数量/大小上限、symlink 不跟随、写入路径越界检查
- Skill 分析：只读文件内容（≤512KB），不安装依赖、不执行脚本、不启动 MCP
- 浏览器/CLI 永不提交绝对路径作为导入目标（CLI 本地读取后以内容上传）

## CLI / MCP

- CLI：`resource import <project> <dir|zip|url>`；`resource read --path` 可读包内文件（真实子进程测试）
- MCP：现有 resource list/describe/read 自动支持目录资源（path 参数）

## Tests actually run

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 119 |
| local-core unit | ✅ 31 files / **157 tests** |
| domain / contracts | ✅ 5 / 4 |
| architecture / integration | ✅ 27 / 5 |
| build / smoke | ✅ |
| E2E | ✅ 6/6 |

## Known limitations

- Web 端目录/压缩包拖放入口未做（计划归 U5 Workbench + E2E）；当前经 CLI/API 使用
- ZIP 不支持 ZIP64 / 加密 / 非常规压缩（MVP 拒绝并报错）
- Skill 理解不含依赖安装可行性评估（只列出依赖文件）；不执行任何包内代码
- YAML/JSON Analyzer 对包内配置的深入结构理解仍为保守子集

## Rollback

纯新增；无 Schema 变更、无数据破坏；可独立 revert。

## Go / Stop

**STOP — U3 交付点。** 下一步 **U4（ResourceMatcher + ContextManifest ResourceRef）**，或按 Dz 调整顺序。

---

_Codex 2026-08-02，全部结果基于本次实测。_
