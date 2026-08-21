# Embedding Benchmark｜nomic-embed-text（第一轮）

> 日期：2026-08-11（晚）
> 脚本：`scripts/embedding-benchmark.mjs`（`node scripts/embedding-benchmark.mjs [model]`）
> 环境：本机 Ollama 服务（`127.0.0.1:11434`），模型 `nomic-embed-text:latest`（137M / F16 / 768 维 / ctx 2048）
> 前置验收：`LCOS_OLLAMA_URL=http://127.0.0.1:11434 LCOS_REQUIRE_SQLITE_VEC=1 node scripts/conversation-semantic-smoke.mjs`
> → `provider=real-ollama, backend=sqlite-vec, indexedMessages=139, dimensions=768`，hybrid 检索 10 条命中全部带 `vector` reason

## 延迟与吞吐

| 指标 | 数值 |
|---|---|
| 单条 embed（预热后中位数） | 33.1 ms |
| 单条样本 | 30.6 / 30.7 / 30.7 / 32.3 / 33.1 / 33.2 / 33.2 / 35.4 ms |
| batch 8 条总耗时 | 87.6 ms（约 11 ms/条） |
| 维度 | 768 |

## 语义质量（mini corpus 8 段，cosine top1）

| Query | Top1 是否语义正确 |
|---|---|
| 如何把上下文打包交给另一个对话？ | ✅（Handoff zip 条目，0.655） |
| 快照之间怎么对比差异？ | ✅（Context 快照条目，0.600） |
| 向量检索怎么做到关键词之外的语义匹配？ | ❌（泛化不足，命中的是备注/捕获条目） |

## 结论

- 本地轻量可用：单条 ~33ms 完全够 Agent 日常检索；sqlite-vec + hybrid（FTS+vector）链路已真实激活。
- 短句语义区分一般：第 3 条 query 暴露 nomic 对“语义检索”类短句的召回弱点——正是要拿 qwen3-embedding 对比的原因。

## qwen3-embedding（待补）

- 本机尚未拉取成功（下载超时，网络到 registry 慢）。拉取命令：`ollama pull qwen3-embedding`（应用内可看进度）。
- 拉好后重跑：`node scripts/embedding-benchmark.mjs qwen3-embedding`，并把结果并入本文档的对比表。
