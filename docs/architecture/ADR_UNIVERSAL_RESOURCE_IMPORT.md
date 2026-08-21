# ADR — Universal Resource Import（通用资源零负担导入）

> 日期：2026-08-02
> 状态：**U0 已批准实施，U1–U5 待评审后推进**
> 依据：GPT 方案 `CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md`；需求方合并主线标准第 1、5、6 条

## 1. 变更原因

当前 LCOS 只支持"MD/TXT/图片 + 手工填写用途"的资源进入方式：Link 表单强制（或常驻）要求 description/purpose，Skill 没有导入入口，文件夹/ZIP/JSON/YAML 无法直接上画布。真实工作流里用户希望**把文件直接放进去，系统自己理解**，而不是先填表。

合并主线标准要求：工作流常用文件能正常上画布；CLI/MCP 让 Agent 直接读取资源与理解结果；画布免发送成为 Agent 上下文。

## 2. 变更前流程

```text
拖入 MD/图片 → Import Copy → Artifact/Revision/View（无理解层）
粘贴链接 → 前端填 url/title/description/purpose → 前端生成 .link.md → Import Copy
Skill/文件夹/JSON/YAML → 无统一入口
```

## 3. 变更后流程（GPT 方案冻结）

```text
拖入文件/文件夹/压缩包 或 粘贴链接
→ Web 只提交来源 + 可选摆放位置 + 可选备注（零表单）
→ UniversalResourceImportService
→ 注册 Source/Artifact/Revision/View（复用现有正式 Service）
→ Fast Descriptor（同步，确定性）
→ Canvas 立即出现正式节点（importing → persisted → understanding pending → ready/partial/failed）
→ Resource Understanding（异步，Analyzer Registry）
→ ResourceDescriptorV0（可重建，不替代原文）
→ Workbench 展示 / CLI / MCP 可读
→ Run 时 ResourceMatcher 给出候选
→ ContextManifest 记录本次实际采用资源
→ Buddy / Codex 按需读原文（ResourceReader）
```

核心原则：

```text
导入不等于分类
分类不等于执行
Descriptor 不替代原文
匹配发生在 Run 时
无法识别不阻止导入
```

## 4. 用户操作变化

- Link / 文件导入不再要求 purpose / description / category / workflowStage。
- 导入后节点立即出现；理解失败仍保留节点，显示"系统暂未完全理解，Agent 仍可读取原始内容"。
- Skill 不再有独立导入世界：文件 / 文件夹 / 压缩包 / 链接统一入口，Skill 只是识别出的候选语义。

## 5. 数据流变化

- 新增 `ResourceDescriptorV0` 派生层：由 ArtifactRevision / Link Source 派生，可重建，不进入 Artifact 核心含义。
- 新增 `ResourceSourceV0`：浏览器只提交 uploadId / selectionId / url 等不透明标识，**永不提交绝对路径**。
- 新增 `ResourceMatcher`：Run 时确定性评分（capability 0.35 / kind 0.20 / input 0.15 / output 0.15 / activeContext 0.10 / pin 0.05），不持久化分类。
- ContextManifest 新增 `ManifestResourceRefV0` 可选段：只记录本次实际采用资源，不塞全部资源。
- 文件夹 / ZIP：安全复制到 `<Project Root>/imports/resources/<resourceId>/source/`，写 `resource-manifest.json`（不存绝对路径）。

## 6. 影响模块

| 模块 | 变更 |
|---|---|
| `packages/contracts/src/resources.ts` | ✅ 已新增（U0）：ResourceSourceV0 / ImportResourceRequestV1 / ResourceDescriptorV0 / ResourceMatchV0 / ManifestResourceRefV0 |
| `apps/local-core/src/resources/` | 新建：UniversalResourceImportService、descriptor-service/repository、matcher、reader、security、analyzers |
| `apps/local-core/src/metadata-repository.ts` | v7 迁移：`resource_descriptors` 表（createPending / replaceDerivedDescriptor / getCurrentForRevision / listByProject / markFailed） |
| `apps/local-core/src/server.ts` | 新增 resources 路由（import / import-url / list / get / descriptor / content / reanalyze / match） |
| `apps/web/src/features/create/LinkReferenceDialog.tsx` | 去表单（去 description/purpose 必填） |
| `apps/web/src/features/resources/UniversalImportPanel.tsx` | 新建统一导入面板 |
| `apps/web/src/runtime/v07UiContracts.ts` | Link 生成逻辑服务端化；CapabilitySet 扩展 |
| `tools/lcos-agent/cli.mjs` / `mcp-server.mjs` | 新增 resource list/describe/read/match 工具 |
| `packages/skills/lcos-project-context/SKILL.md` | 更新 |

## 7. 文件与 Schema 迁移

- 当前 schemaVersion = 6 → **vNext = 7**。
- 新增表（唯一约束 `artifact_id + source_revision_id + analyzer_version`）：

```sql
CREATE TABLE resource_descriptors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  source_revision_id TEXT NOT NULL,
  descriptor_version TEXT NOT NULL,
  analyzer_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','ready','partial','failed')),
  source_content_hash TEXT,
  descriptor_hash TEXT NOT NULL,
  descriptor_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(artifact_id) REFERENCES artifacts(id),
  FOREIGN KEY(source_revision_id) REFERENCES artifact_revisions(id),
  UNIQUE(artifact_id, source_revision_id, analyzer_version)
);
```

- Repository 只暴露 5 个方法，不提供 generic upsert / frontend patch。
- 迁移执行归 U1（Descriptor 持久化落地时），U0 不执行。

## 8. 开发成本

按切片：U0 审计+合同（本轮已完成）→ U1 单文件/URL 零表单导入 → U2 Analyzer + Reader → U3 文件夹/ZIP/Skill 包 → U4 Matcher + Manifest → U5 Workbench + E2E。估计 U1–U5 约 3–5 个开发日（集中测试节奏）。

## 9. 风险

- SSRF（URL 抓取）：只允许 http/https，拒绝 loopback/私网，限制重定向/大小/超时，不携带 Cookie。
- ZIP 穿越 / symlink / junction / 路径越界：staging 验证 + 拒绝，失败清理。
- Analyzer 误判：只输出带 evidence 的候选，`unknown` 合法；不阻止导入。
- 敏感文件：默认排除 `.env`、密钥、`.git/`、`node_modules/` 等。
- 并发：Matcher/理解任务使用本地 single-flight 队列，不引入完整任务系统。
- 前端能力声明：UI 能力必须来自 Runtime CapabilitySet，不显示"未来支持"按钮。

## 10. 验收条件（U0 阶段）

- ✅ Preflight 输出（本批次 `docs/audit/UNIVERSAL_RESOURCE_IMPORT_PREFLIGHT.md`）
- ✅ Contracts 新增并导出，typecheck / contracts 测试通过
- ✅ ADR 落盘（本文）
- ⏳ Schema impact 已记录，迁移在 U1 执行
- ⏳ Legacy field map 已记录，新写路径删除在 U1

## 11. 回滚方案

- U0 仅新增 contracts 类型与文档：删除 `packages/contracts/src/resources.ts` + index 导出即可，无数据影响。
- U1+ 迁移：v7 迁移仅新增表，可独立 revert；已导入数据不受影响。
- 整体回滚 = revert 对应 Slice commit；不触碰既有 schema v6 数据。

---

_U0 完成，等待评审后进入 U1。_
