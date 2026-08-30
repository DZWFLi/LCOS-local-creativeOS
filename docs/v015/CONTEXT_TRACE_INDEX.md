# LCOS v0.15 Context Trace Index

日期：2026-08-30  
用途：**给 Codex / TRAE / 后续执行 Agent 的“语义追溯路由表”**。当代码功能、对象归属、交互含义、产品裁决或历史沿革模糊时，不要凭经验猜。先从本索引定位 **当前语义 → canonical code → executable tests → 决策证据**。

> 本索引不是需求大全，也不是另一个 PRD。它只回答：**“我现在不确定这个东西到底是什么，该去哪里查？”**

---

## 0. 使用协议

出现以下任意症状时立刻使用本索引：

- “这个 service 看起来和另一个很像，是不是可以合并/重写？”
- “这个 UI state 找不到 Core 对应物，是不是前端自己存一份？”
- “旧文档说 A，现在代码像 B，哪个是真的？”
- “这个按钮按状态应该能出现吧？”
- “这个 Surface 是不是一个独立 Workspace/Graph？”
- “这个 Skill 是 UI 节点、Markdown 还是 package？”
- “这个 Agentlet 是不是该新建一个 runtime？”
- “搜索是不是应该新增 vector/RAG 模式开关？”
- “某个格式看起来应该支持，能不能顺手加？”

追溯顺序固定：

```text
本索引语义摘要
→ Canonical Code
→ Executable Tests / Gate
→ v0.15 Closeout / Decision Evidence
→ 若仍冲突：CONTEXT_GAP
```

禁止反向顺序：不要先读 8 月 18 日旧 PRD，再拿它解释 8 月 30 日代码。

---

# 1. Authority Levels

## A0 · 当前运行真相

优先级最高：

- current contracts
- current Local Core services/repositories
- current Web projection/client wiring
- executable tests/gates
- current schema/migrations

代码不是天然正确，但**已通过 v0.15 closeout 的当前代码 + 测试**比旧文档更可信。

## A1 · v0.15 当前入口

- `AGENTS.md`
- `docs/v015/CODEX_START_HERE_V015.md`
- `docs/v015/CONTEXT_TRACE_INDEX.md`
- `docs/OPEN_DEBTS.md`（应在 final convergence 阶段继续净化为 active debt）

## A2 · v0.15 Closeout / Recovery evidence

优先使用：

- `_HANDOFF/LCOS_v0.15_R1B_HumanLanguageGate_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R1C_UnifiedComposer_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R1D_PreviewFragmentFallback_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2A_MarkerCoreWebBridge_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2B_GlythSemanticLOD_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2C_SpatialNavigationFamily_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2D_InteractionGrammar_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R3A_CatalogColony_Closeout_20260829.md`
- `docs/recovery/LCOS_后端回传_Skill_Huabu对齐_20260827.md`
- `docs/census/capability-map.v0.json`

这些文件是证据，不是“重新施工任务单”。若功能已存在，禁止重复 apply historical patch。

## A3 · Historical evidence only

默认**不得指导实现**：

- `BUILD_INFO_DESKTOP_CAPTURE_BASELINE_PASS8_20260818.md`
- `BUILD_INFO_DESKTOP_CAPTURE_SKILL_V43_PASS9_20260818.md`
- `CODEX_PASS8_STANDALONE_BASELINE_REQUEST_20260818.md`
- `LCOS_0.1_*_20260818.md`
- `LCOS_PHASE_SNAPSHOT_0.1_*`
- `MVP_V1_EXECUTION_README.md`
- 旧 Phase2.5 / Phase A–H / early R31 docs
- 旧 Prototype / AdFrame 产品描述

只有本索引明确引用某个历史文件用于**某个局部实现事实**时，才读对应部分。

---

# 2. Product / Surface Trace

## 2.1 Main / Context / Workflow / Assembly 到底是什么？

**当前语义**

```text
Main      = 项目地形
Context   = 项目理解 / 演进
Workflow  = 项目行动
Assembly  = 项目级共用仓库 + 装配现场
```

四者共享 Project Objects / spatial physics，但不共享完全相同的关系语义与组件目录。Surface 是 projection/work surface，不是第二份 Project Graph。

**Canonical Code**

- `apps/web/src/App.tsx`
- `apps/web/src/state/presentationViewState.ts`
- `apps/web/src/state/projectPresentationMembership.ts`
- `apps/local-core/src/presentation-repository.ts`
- `apps/local-core/src/presentation-application-service.ts`
- `apps/local-core/src/routes/presentations.ts`
- `apps/local-core/src/assembly-apply-service.ts`
- `apps/local-core/src/routes/f6-assembly.ts`
- `packages/contracts/src/presentations.ts`
- `packages/contracts/src/assembly.ts`

**Tests**

- `apps/web/tests/presentationMembershipContract.test.ts`
- `apps/web/tests/presentationViewState.test.ts`
- `apps/local-core/tests/presentation-persistence.test.ts`
- `apps/local-core/tests/assembly-f6-b2.test.ts`
- `apps/local-core/tests/assembly-apply-f6-b3.test.ts`
- `apps/local-core/tests/assembly-membership-f6-b5.test.ts`

**不要复活**

- “每个 Workspace 是一个独立 Graph”
- “Assembly 是某个 Surface 的弹窗”
- “给 Context/Workflow 各造一份对象副本”

---

## 2.2 Presentation 和 Domain Truth 的边界？

**当前语义**

Presentation 管：

- member/hidden membership
- position
- hierarchy
- emphasis
- pinned
- presentation-only edges

Presentation 不拥有 Artifact 本体，不应偷偷创造 domain relation truth。

**Canonical Code**

- `packages/contracts/src/presentations.ts`
- `apps/local-core/src/presentation-repository.ts`
- `apps/local-core/src/presentation-application-service.ts`
- `apps/web/src/state/presentationHierarchyState.ts`
- `apps/web/src/features/presentation/*`

**Tests**

- `apps/local-core/tests/presentation-persistence.test.ts`
- `apps/local-core/tests/context-prompt-presentation-independence.test.ts`
- `apps/web/tests/presentationHierarchy.test.ts`
- `apps/web/tests/presentationTransientContract.test.ts`

**Decision evidence**

- `docs/handoffs/HU3A_PRESENTATION_TRUTH_PURIFICATION_HANDOFF_20260811.md`（只用于 Presentation truth purification 这个局部）

---

# 3. Interaction Trace

## 3.1 Selection / Reference / Relation / Mapping 有什么区别？

**当前语义**

```text
Click            = Selection
Shift+Click      = additive Selection
Ctrl/Cmd+Click   = 本次 Reference
Drag body        = Move / Semantic Drop
Drag Light Notch = Relation
```

Selection 是当前操作集合；Reference 是本次命令上下文；Relation 是显式关系创建；durable mapping 是另一类持久绑定。不得混成 Attach Context。

**Canonical Code**

- `apps/web/src/App.tsx`
- spatial interaction / relation handlers under `apps/web/src/features/spatial/`

**Tests / Gate**

- `scripts/validate-v015-r2d-interaction-grammar.mjs`
- `npm run check:v015-r2d`

**Decision evidence**

- `_HANDOFF/LCOS_v0.15_R2D_InteractionGrammar_Closeout_20260829.md`

---

## 3.2 Search / Focus / Action Launcher 为什么分开？

**当前语义**

- Search：不知道对象在哪/叫什么，找内容。
- Focus：已知当前 Selection，只回答它出现在哪里。
- Action Launcher：动作入口，不是第二个内容搜索框。

快捷键：

```text
Ctrl/Cmd+F = Search
F          = Focus
Ctrl/Cmd+K = Action Launcher
```

**Canonical Code**

- `apps/web/src/App.tsx`
- project search / focus / tools related states and components
- `apps/local-core/src/project-search-service.ts`

**不要复活**

- “全文 / 向量 / 数据库 / Project Focus”四个模式开关
- Launcher 里再塞项目全文搜索

---

## 3.3 Unified Composer 是什么？

**当前语义**

执行输入的统一 Composer，跨合适 Surface 复用，不要 Context 一个、Workflow 一个、Main 一个各自漂移。

**Canonical Code**

- `apps/web/src/features/execution/UnifiedExecutionComposer.tsx`

**Decision evidence**

- `_HANDOFF/LCOS_v0.15_R1C_UnifiedComposer_Closeout_20260829.md`

---

# 4. Spatial System Trace

## 4.1 Colony 是什么？

**当前语义**

Colony 是空间集合/组织投影语义，用于替代旧 Fence/Region 心智；不是新 domain entity 仓库。

**Canonical Code**

- `apps/web/src/state/spatialColony.ts`

**Decision evidence**

- `_HANDOFF/LCOS_v0.15_R3A_CatalogColony_Closeout_20260829.md`

---

## 4.2 Marker / Glyth / Spatial Navigation 是什么层？

**Marker**：定位/空间导航信号，Core↔Web 有真实 bridge。  
**Glyth**：具备 semantic LOD 的空间对象视觉投影，不是纯装饰 avatar。

**Canonical Code**

- `apps/local-core/src/navigation-marker-service.ts`
- `apps/local-core/src/routes/navigation-markers.ts`
- `apps/web/src/features/spatial/SpatialMarkerLayer.tsx`
- `apps/web/src/features/spatial/spatialMarkerSystem.ts`
- `apps/web/src/features/spatial/glythSemanticLod.ts`
- `apps/web/src/features/spatial/visual/LcosGlyth.tsx`

**Tests / Evidence**

- `apps/local-core/tests/navigation-marker-f6a2.test.ts`
- `apps/web/src/features/spatial/__tests__/spatialMarkerSystem.test.ts`
- `apps/web/src/features/spatial/__tests__/glythSemanticLod.test.ts`
- `_HANDOFF/LCOS_v0.15_R2A_MarkerCoreWebBridge_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2B_GlythSemanticLOD_Closeout_20260829.md`
- `_HANDOFF/LCOS_v0.15_R2C_SpatialNavigationFamily_Closeout_20260829.md`

---

# 5. Skill Trace

## 5.1 Skill 到底是 Markdown、节点还是 Project Object？

**当前语义**

Skill 是一等 Project Artifact / Object。它的 canonical truth 是**可移植 Skill package**；GUI 中的 Skill node / Skill Builder 只是 projection。

Root Skill 负责 identity / trigger / route / orchestration；Subskill 是可独立复用的完整 Skill package。资源按 instructions/references/scripts/assets 等按需装载。

**Canonical Code**

- `apps/local-core/src/skill-package-service.ts`
- `apps/local-core/src/skill-catalog-service.ts`
- `apps/local-core/src/skill-proposal-service.ts`
- `packages/contracts/src/skill-composition.ts`
- `apps/web/src/features/assembly/AssemblySkillSource.tsx`
- Skill Builder related Web components/states
- `packages/skills/*`

**Tests / Gates**

- `apps/local-core/tests/skill-package-service.test.ts`
- `apps/local-core/tests/skill-proposal-service.test.ts`
- `apps/local-core/tests/skill-composition.test.ts`
- `npm run check:v015-s2`
- `npm run check:v015-s3`
- `npm run check:v015-s8`

**Decision evidence**

- `docs/recovery/LCOS_后端回传_Skill_Huabu对齐_20260827.md`

---

## 5.2 谁能写 `.creative-os/skills`？

**当前语义**

`SkillPackageService` 是 project Skill package canonical filesystem writer。System Skill 只读。Catalog 是 read/projection，不准复活第二 writer。

**Canonical Code**

- `apps/local-core/src/skill-package-service.ts`
- `apps/local-core/src/skill-catalog-service.ts`
- `apps/local-core/src/compose.ts`

**不要机械套旧 wiring**

如果当前 `SkillCatalogService(metadata)` 本身没有写 FS，不需要为了长得像历史 GPT integration 而强行改 constructor。看 ownership，不看旧签名。

---

## 5.3 SkillProposal 的 `createdBy` 为什么重要？

Completed Run 自动发现的 candidate 只是系统生成材料，Skill Author 尚未做 Method-vs-Fact / Root/Subskill 提炼，因此此阶段必须是：

```text
createdBy = system
```

不能展示成“AI 已学会”。

**Canonical Code / Tests**

- `apps/local-core/src/skill-proposal-service.ts`
- `apps/local-core/tests/skill-proposal-service.test.ts`
- `npm run check:v015-s3`

---

# 6. Runtime / Execution Trace

## 6.1 Run、Bridge、ExecutionItem 谁是真相？

**当前语义**

```text
Local Core Run/Task = canonical runtime truth
ExecutionItemV1     = canonical UI execution projection
Bridge              = transport/executor integration
Web/Companion       = consumer
```

Web controls 只看 `availableActions`。ExecutionItem 不存在时 fail-close。

**Canonical Code**

- `apps/local-core/src/runtime-application-service.ts`
- `apps/local-core/src/runtime-adapter.ts`
- `apps/local-core/src/execution-item-service.ts`
- `apps/local-core/src/routes/runtime.ts`
- `apps/web/src/App.tsx`
- Local Core client execution item endpoint wiring

**Tests / Gates**

- `apps/local-core/tests/execution-item-service.test.ts`
- `npm run check:v015-s1`
- `npm run check:v015-s7`

**Final-convergence known audit point**

If `App.tsx` falls back from missing ExecutionItem to guessing actions from `activeRun.status`, that is a v0.15 blocker. Remove it; missing action = no action.

---

## 6.2 SSE / project events 属于谁？

**当前语义**

Core project event hub is the product-side event projection; S6 exposes project SSE with reconnect and polling fallback. Bridge real push is a runtime E2E concern, not a reason to invent another browser state bus.

**Canonical Code**

- project event hub/service
- SSE route around `GET /projects/:id/events`

**Gate**

- `npm run check:v015-s6`

---

# 7. Curator Trace

## 7.1 `lcos-project-curator` 是不是新 Runtime？

**不是。**

它是 existing agentlet/runtime architecture 上的 semantic executor identity。

**Current flow**

```text
Curator intent
→ AgentletRuntimeService / harness
→ semantic provider seam
→ structured CuratorReorganizeResultV1
→ validateCuratorReorganizeResult
→ ReorganizeService.create
→ preview/ghost
→ Keep / Revert existing lifecycle
```

**Canonical Code**

- `apps/local-core/src/curator-dispatch-service.ts`
- `apps/local-core/src/agentlet-runtime-service.ts`
- `apps/local-core/src/reorganize-service.ts`
- `packages/contracts/src/curator-dispatch.ts`
- `packages/agentlets/lcos-project-curator/agentlet.yaml`
- `packages/agentlets/lcos-project-curator/main.mjs`

**Tests / Gate**

- `apps/local-core/tests/curator-dispatch-service.test.ts`
- `apps/local-core/tests/curator-agentlet-e2e.test.ts`
- `npm run check:v015-p0c`

**不要复活**

- browser `sqrt(N)` fake Agent Arrange
- agentlet 直接 mutate canvas
- 不经 schema validation 的“差不多 JSON”

---

# 8. Skill Author Trace

## 8.1 `lcos-skill-author` 负责什么？

**当前语义**

它对 completed Run / frozen run context 做真正 semantic distillation：

- Method vs Fact
- Root/Subskill
- reusable instructions/resources structure
- structured SkillProposal

最终写 package 仍由 Skill proposal review + `SkillPackageService` 承担。

**Canonical Code**

- `apps/local-core/src/skill-author-dispatch-service.ts`
- `apps/local-core/src/skill-proposal-service.ts`
- `apps/local-core/src/skill-package-service.ts`
- `packages/contracts/src/skill-author-dispatch.ts`
- `packages/agentlets/lcos-skill-author/*`

**Tests / Gate**

- `apps/local-core/tests/skill-author-dispatch-service.test.ts`
- `apps/local-core/tests/skill-author-agentlet-e2e.test.ts`
- `npm run check:v015-p0d`

**Release E2E rule**

Rule fallback 可以用于 deterministic test；不能冒充 real-provider Skill Author E2E。

---

# 9. Companion Trace

**当前语义**

Companion 是 Core truth 的另一投影，不拥有第二 Run/Project state。

**Canonical Code**

- `packages/contracts/src/companion-projection.ts`
- `apps/local-core/src/companion-projection-service.ts`
- Desktop / Companion window integration

**Tests / Gate**

- `apps/local-core/tests/companion-projection-service.test.ts`
- `npm run check:v015-s4`

---

# 10. Search / Semantic Retrieval Trace

## 10.1 产品层 Search 和底层 retrieval provider 的关系？

用户只看到 **Search**。底层自动融合 text/FTS/semantic/spatial 等候选，不暴露“数据库/向量/RAG模式”。

**Canonical Code**

- `apps/local-core/src/project-search-service.ts`
- `apps/local-core/src/semantic-index-service.ts`
- `apps/local-core/src/spatial-retrieval-service.ts`
- `apps/local-core/src/search-artifact-body.ts`
- `apps/local-core/src/semantic-provider-registry.ts`
- `apps/local-core/src/search-format-coverage.ts`

**Tests**

- `apps/local-core/tests/semantic-search.test.ts`
- `apps/local-core/tests/semantic-chunking.test.ts`
- `apps/local-core/tests/vector-knn.test.ts`
- `apps/local-core/tests/spatial-retrieval-service.test.ts`
- `apps/local-core/tests/semantic-provider-registry.test.ts`
- `apps/local-core/tests/search-format-coverage.test.ts`

**Gates**

- `npm run check:v015-s9`
- `npm run check:v015-s10`

---

## 10.2 S9 Provider 化到底改变什么？

**EXTEND，不重写。**

保留：

- `chunkEntity`
- chunkAnchor
- content/chunk hash differential indexing
- sqlite-vec native path
- blob fallback
- project-scoped vector retrieval
- mutation-driven reindex

抽 seam：

- `EmbeddingProvider`
- `RetrievalProvider`
- `ContentExtractor`
- `VisualEmbeddingProvider`
- `SemanticProviderRegistry`

默认：Ollama local embedding adapter + Local repository chunk retrieval。

Visual embedding 当前**没有默认 provider**，这是事实，不是缺测试。

---

## 10.3 S10 格式支持到底看哪里？

唯一格式真相：

```text
apps/local-core/src/file-format-registry.ts
×
apps/local-core/src/search-format-coverage.ts
×
apps/local-core/src/search-artifact-body.ts
```

每个 known format 必须是：

```text
SUPPORTED + real extractor
或
UNSUPPORTED + explicit reason
```

不存在 `PLANNED`。

当前新增 real text extraction：

- CSV
- JSON
- YAML/YML
- XML
- HTML

已有并保留：

- Markdown/Text
- PDF text layer
- DOCX
- PPTX
- bitmap OCR evidence (PNG/JPG/JPEG/WebP/GIF/BMP)

明确 unsupported 示例：

- TIFF（当前 OCR 不支持）
- SVG（无注册 extractor）
- DOC/PPT/XLS legacy binary
- XLSX
- audio/video
- PSD/AI
- generic ZIP search flattening

---

## 10.4 Mutation-driven reindex / stale cache 是否还要新造？

**不用。KEEP 现有主线。**

当前真实 reindex anchors 包括：

- `apps/local-core/src/import-copy-service.ts`
- `apps/local-core/src/capture-application-service.ts`
- `apps/local-core/src/curation-command-service.ts`
- `apps/local-core/src/runtime-review-service.ts`
- `apps/local-core/src/routes/runtime.ts`

`SemanticIndexService.indexEntity` 已有 document/chunk `contentHash` guard；`ProjectSearchService` search-time ensure 是 TTL repair，不是 primary writer。

除非 E2E/census 发现真实漏挂点，否则不要再造第二套 reindex scheduler。

---

# 11. Resource Analyzer Trace

Resource Analyzer 和 Search Content Extractor **不是一回事**。

Analyzer 回答：

> “这个资源是什么、有哪些 capability / entrypoint / understanding？”

Search Content Extractor 回答：

> “有什么真实文本证据可以进入检索索引？”

**Analyzer Canonical Code**

- `apps/local-core/src/resources/analyzers/analyzer-registry.ts`
- `markdown-analyzer.ts`
- `text-analyzer.ts`
- `json-analyzer.ts`
- `yaml-analyzer.ts`
- `skill-package-analyzer.ts`
- `link-analyzer.ts`
- `fallback-analyzer.ts`
- `apps/local-core/src/resources/universal-resource-import-service.ts`

不要为了 S10 把 Analyzer 和 Extractor 合成一个超级接口。

---

# 12. Capture Trace

**当前语义**

Capture 是 intake/staging → canonical materialization / semantic drop 的入口，不直接把浏览器/Explorer临时状态当 Project truth。

**Canonical Code**

- `apps/local-core/src/capture-application-service.ts`
- `apps/local-core/src/capture-gateway-service.ts`
- `apps/local-core/src/capture-space-service.ts`
- Desktop Capture related code
- browser extension code

**Search relation**

Capture materialize 已挂 mutation-driven `reindexArtifact`。如果调整 Capture，不要让 search 回到 search-time 才补索引。

**Native QA reminder**

Explorer OLE drag / `.lnk` / `.url` / DPI / Edge extension 是真实 Windows QA，不能 DOM mock 冒充。

---

# 13. Bridge / MCP Trace

**当前语义**

Bridge 管 executor transport / task status / event transport；Core 仍是产品 canonical runtime projection owner。

**Canonical Code**

- `tools/light-bridge-kernel/`
- `tools/lcos-agent/`
- `tools/codex-orchestrator/`
- `apps/local-core/src/bridge-rest-client.ts`
- `apps/local-core/src/runtime-adapter.ts`
- MCP scripts / smoke tests

**Release E2E**

至少要真实验证 Bridge push/reconnect + MCP call through Core，不是只验证 polling fallback。

---

# 14. Persistence / Schema Trace

遇到“重启后谁负责恢复”的问题，优先看：

- `apps/local-core/src/metadata-repository.ts`
- presentation repository
- Skill package filesystem + metadata
- runtime dispatch/run persistence
- proposal persistence
- migration tests / schema smoke scripts

**红线**

- 不允许 E2E 直接写 SQLite 制造状态
- migration 必须可重复启动
- late async writer 不得 resurrect tombstone
- stale CAS 不得 silent overwrite

---

# 15. Test / Release Trace

不要相信一个名叫 `full-gate` 的文件就一定是当前 full gate。

现有 `.github/workflows/full-gate.yml` 的 Phase2.5 命名属于历史。Final v0.15 证据必须分层：

```text
static/type/unit
→ architecture/integration
→ Browser E2E
→ real semantic provider
→ Bridge/MCP
→ Desktop/Companion
→ Capture
→ restart persistence
→ failure injection
→ Windows native QA
→ installer
→ cross-system Golden Path
```

任何层没跑，报告真实状态：

- `PASS`
- `FAIL`
- `SKIPPED_NON_RELEASE`
- `BLOCKED_ENV`
- `PENDING_NATIVE_QA`

---

# 16. 常见“误判 → 正确追溯”速查

| Codex 产生的疑惑 | 不要做 | 先查 |
|---|---|---|
| 找不到 GPT 651043f commit | reset/reapply patch | `AGENTS.md` + 当前本地线；651043f 仅 semantic reference |
| SkillCatalog constructor 和旧 GPT 不一样 | 机械改签名 | 看 `skill-catalog-service.ts` 是否真实写 FS；ownership 才是红线 |
| Curator 没 RuntimeDispatch 字样 | 新建 CuratorRuntime | `curator-dispatch-service.ts` + `agentlet-runtime-service.ts` + ExecutionItem projection |
| 看到规则 fallback | 删掉所有 fallback | deterministic test 可保留；release real-provider E2E 必须单独 fail if unavailable |
| 某格式“看起来能解析” | 顺手 claim supported | `search-format-coverage.ts`，没真实 extractor 就 UNSUPPORTED |
| waiting_input 看起来应该有 Answer | Web 自己显示 | `ExecutionItemV1.availableActions`；缺 action 就 fail-close |
| Context 和 Main 都要展示同一 Artifact | copy object | Presentation projection / membership |
| 旧文档说 Ctrl+F 是别的 | 恢复旧快捷键 | R2D + 本索引 interaction grammar |
| “AI Arrange”可以直接排网格 | browser geometry | Curator structured proposal + ReorganizeService |
| Search 需要 Vector 模式 | 加模式切换 | product only exposes Search；provider 是 infra |

---

# 17. 无法解析时的标准输出

如果经过本索引仍然存在冲突，不要自行折中。输出：

```text
CONTEXT_GAP:
Concept:
Conflicting current sources:
- file/symbol A:
- file/symbol B:
Tests that currently encode behavior:
Historical evidence consulted:
Risk of guessing:
Recommended smallest decision needed:
```

这不是失败。**偷偷猜才是失败。**
