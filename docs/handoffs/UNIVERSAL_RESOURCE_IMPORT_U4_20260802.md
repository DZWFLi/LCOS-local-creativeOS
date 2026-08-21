# Universal Resource Import — U4 交付（ResourceMatcher + ContextManifest ResourceRef）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` Slice U4
> 状态：已完成，未提交（等待 Dz 指示）

## Decision

U4 完成：Run 时确定性 ResourceMatcher 给出候选（capability 0.35 / kind 0.20 / input 0.15 / output 0.15 / activeContext 0.10 / pin 0.05）；匹配结果以 `ManifestResourceRefV0` 记入 ContextManifest；RuntimeInputPack 物化 Descriptor 文本与 Read First 文件；CLI/MCP 新增 match；匹配不写回 Artifact。

## Current evidence

- `resources/resource-matcher.ts`：关键词分词（英文单词 + CJK 二元组），Top 8 资源 / 最多 3 个候选 Skill；Exclude 过滤；未授权 Skill → `requiresApproval: true`；tool_config 不会被当成可执行 Skill；匹配结果不持久化分类
- ContextManifest：新增可选 `resourceRefs` 段（`ManifestResourceRefV0`），只记录本次 Run 实际采用资源
- RuntimeInputPack：新增 `resourceRefs` + `resourceFiles`（每个资源含 `<descriptor>` 文本 + readFirst 文件内容，单文件 ≤32KB、最多 6 个资源，读取失败不阻断派发）
- HTTP：`POST /projects/:id/resources/match`（读 ActiveContext 的 selected/excluded/pinned 映射）
- CLI：`lcos resource match <project> --instruction "..."`；MCP：`lcos_resource_match`

## Changed files

| 文件 | 变更 |
|---|---|
| `resources/resource-matcher.ts` | 新建 |
| `context-manifest-service.ts` | resourceRefs 可选段 |
| `runtime-application-service.ts` | create 前运行 Matcher → Manifest refs |
| `runtime-adapter.ts` | RuntimeInputPack resourceRefs/resourceFiles 物化；RuntimeProjectReader 扩展 |
| `packages/contracts/src/index.ts` | BuildContextManifestV0Input.resourceRefs |
| `server.ts` | match 路由 |
| `tools/lcos-agent/cli.mjs` / `mcp-server.mjs` | match 工具 |
| 测试 | matcher 5、match-http 1、runtime-pack 1 |

## Schema / Migration

无（ContextManifest 为 optional section；RuntimeInputPack 为运行时产物）。

## Matching behavior

```text
instruction + outputIntent + ActiveContext(selected/excluded/pinned)
→ 确定性评分 → Top 8（Skill 候选 ≤3）→ ManifestResourceRef
→ RuntimeInputPack 物化描述 + Read First
```

- 排除项不进入候选；未授权 Skill 标记 requiresApproval；匹配结果不写回 Artifact/Descriptor
- pending（未理解）资源因无能力/类型证据自然低分，需 reanalyze 后参与匹配

## Security

- pack 文件读取沿用资源边界（manifest 白名单、路径越界拒绝、大小上限）
- 失败读取静默降级，不阻断 Run 派发

## Tests actually run

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 119 |
| local-core unit | ✅ 34 files / **164 tests** |
| domain / contracts | ✅ 5 / 4 |
| architecture / integration | ✅ 27 / 5 |
| build / smoke | ✅ |
| E2E | ✅ 6/6 |

关键证据：真实 Run 链路测试——skill 包导入 → reanalyze → createRun → manifest 含 candidate_skill ref → runtime-input-pack.json 含 `<descriptor>` 与 SKILL.md 内容。

## Known limitations

- 匹配为关键词/结构证据的确定性评分，无向量库（符合计划）
- pending 描述符不参与有效匹配（需要先理解）
- Workbench UI 展示匹配结果未做（U5）

## Rollback

纯新增 + 可选段；无 Schema 变更、无数据破坏；可独立 revert。

## Go / Stop

**STOP — U4 交付点。** 最后一片 **U5（Workbench 展示 + Web E2E + 最终收口）**。

---

_Codex 2026-08-02，全部结果基于本次实测。_
