# Phase F Handoff｜Local Intelligence Layer（Ollama + Native KNN + Retrieval）

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase F 目标：让廉价、可缓存、重复性的语义工作在本地提前完成；Ollama optional，主链永远独立。本轮完成：

1. **Native sqlite-vec KNN**（F11-F14）：`querySearchVectors` 从"全量读入内存逐条点积"升级为 vec0 KNN（表按 `model:dimensions` hash 命名，vec0 metadata 列带 entity_id/project_id；查询 `embedding MATCH ? AND k=? ORDER BY distance`）。`upsertSearchDocumentEmbedding` 同步写 vec0；`deleteSearchDocument` 级联清理；**vec0 不可用时自动回退 blob 线性扫描**（F31/F34）。
2. **启动自动加载**：metadata-repository 主库 `allowExtension: true` + 启动时探测 `.runtime/sqlite-vec/vec0.dll`（env `LCOS_SQLITE_VEC_EXTENSION` 可覆盖），失败静默 + `vectorStatus()` 供 diagnostics。
3. **`lcos local-ai` CLI**（F29 子集）：`status`（走 Core probe）、`models`、`embed-smoke [--model]`（真实调 Ollama /api/embed）。
4. **真实全链路验证**：
   - `lcos local-ai embed-smoke` → nomic-embed-text 返回 **768 维**
   - `npm run smoke:conversation-semantic` → 搜索返回 **vector 命中的语义结果**（Ollama + vec0 + 混合管线全通）

## 现状核查（不重复造）

- `semantic-index-service.ts`：已有 embed/index/delete/searchVectors + loopback 守卫 + 失败降级（沿用，未改）
- `project-search-service.ts`：混合管线 FTS + vector + related 1-hop（沿用）
- `conversation-import-service.ts`：对话语义索引已有 vec0 实现（本轮的 metadata 主库 KNN 与之同模式）
- Ollama 本机：v0.32.6 + nomic-embed-text 已装（Phase A 探测确认）

## Files changed

- `apps/local-core/src/metadata-repository.ts`（KNN + 自动加载 + 级联清理 + vectorStatus）
- `tools/lcos-agent/cli.mjs`（local-ai 分支）
- `apps/local-core/tests/vector-knn.test.ts`（3 用例：vec0 加载 / 最近邻顺序 / blob fallback）

## Tests

- Core：67 文件 / 330 用例全过（新增 3）
- `lcos local-ai embed-smoke`：真实 768 维返回
- `scripts/conversation-semantic-smoke.mjs`：vector 命中，全链路通过

## Explicitly NOT implemented

- ❌ Embedding benchmark（F7）：qwen3-embedding vs nomic 对比与 `docs/benchmarks/` 报告 —— 需要用户 pull 模型后跑，列下一步
- ❌ Semantic affinity hint 自动计算（F19-F21）：`capture_staging_items.semantic_hint_json` 契约与表已存在，但自动 hint 需要项目 semantic profile（F20），本轮未实装；staging 仍走 deterministic 候选
- ❌ LocalIntelligenceQueue（F22-F23）：A-H 先解决功能；队列与优先级 Phase I 资源治理时一并做
- ❌ Local Generation Adapter / 0.8B 小模型（F24-F28）：契约方向明确，等待用户确认模型 + Phase I 资源策略
- ❌ GUI 设置页（F30）：轻量状态显示留 Phase H

## Next risks

1. vec0 是 pre-v1：维度/API 可能 breaking；模型切换（如换 qwen3）会建新 vec0 表（hash 区分），旧表可清理（Phase I）。
2. 自动加载依赖 `.runtime/sqlite-vec/vec0.dll`：分发打包时（Phase J）需要把扩展带进安装包。
3. KNN 查询当前不按 project_id 过滤（vec0 表含 project_id 列但查询没 WHERE project_id）——目前全库 KNN 后由上层 project 过滤语义（search service 层），数据量大时 Phase I 加 project partition。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

