# Phase E Handoff｜Indexed Skill Runtime V2 + Learning Loop

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase E 目标：让 Skill 达到"薄入口 + 索引 + 嵌套按需加载 + 可从 badcase 进化"的完成度。本轮完成：

1. **Curator V2 目录重构**（E2）：`packages/skills/lcos-project-curator/` 从"SKILL.md + 8 references"升级为 Router 结构：薄 SKILL.md + `skill.index.yaml` + 5 routes + 7 policies + 4 recipes + 5 cli + 4 diagnostics + 6 failures + evals 规划。
2. **薄 SKILL.md**（E3）：只保留 Scope / Trigger 路由表 / Hard Redlines / 加载方式 / 通用流程 / 结尾 Trace 要求，全部执行教程外迁。
3. **skill.index.yaml**（E4）：4 个写/读 intent（ingest_conversation / ingest_capture_batch / reorganize / retrieve_for_task / update_existing_project）各带 `base_load` / `conditional_load` / `budget`。
4. **Nested conditional load**（E5）：duplicate_candidates / file_or_url_refs / relation_write / auto_title / ambiguous_project / delete_artifact 等条件按需加载。
5. **CLI resolver**（E6/E23）：`lcos skill resolve <skill> --intent <intent> [--condition ...]` —— deterministic resolver，输出 entry + load + budget；自带极简 YAML 解析器（不引入新依赖）。
6. **SkillTrace + Learning Loop 基础**（E8-E12）：`lcos skill trace <skill> --file <json>` 写入 `~/.lcos/skill-learning/<skill>/traces.jsonl`；`lcos skill review <skill> [--recent N]` 汇总 route 分布 / outcome / avgLoadedChars / correctionRefs。**不自动改文件**（E25）。
7. **安装副本同步**：`scripts/install-lcos-codex-skill.mjs` 已把 V2 结构安装到 `~/.codex/skills/lcos-project-curator`（35 文件）。

## 验证（E26）

- `ingest_conversation` 加载 7 文件 vs `reorganize` 5 文件 vs `retrieve_for_task` 4 文件 —— 三个 intent 加载集合**互不相同**，且没有跨 intent 污染（reorganize 不读 conversation recipe；retrieve 不进 write path）。
- condition 生效：`--condition duplicate_candidates --condition auto_title` 追加 dedupe.md + naming.md。
- Trace/Review 闭环：隔离 learning root 下写 1 条 trace → review 正确计数。

## Tests

- `node scripts/phase-e-smoke.mjs`：intent 路由差异 + load budget + trace/review 闭环 —— 全过
- `lcos-agent smoke`（help）正常

## Explicitly NOT implemented

- ❌ Eval fixtures 实装（E21/E22）：`tests/skill-fixtures/` 目录与判定标准已写入 `evals/README.md`，具体 fixture 数据下一步实装（依赖真实对话样本）
- ❌ SkillPatchProposal 自动化（E13/E14）：接口方向已明确，等 badcase 积累后实装（E25：不允许静默自改）
- ❌ `lcos skill review` 的自动 badcase 解释（第一版只记录，不解释——符合 E10）

## Next risks

1. 极简 YAML 解析器只覆盖 skill.index.yaml 的结构：未来 index 语法扩展需要同步升级解析器。
2. Trace 无 TTL：learning store 会增长，Phase I 加清理。
3. 安装副本已更新，但正在运行的其他 Agent 会话可能需要新会话才加载新 SKILL.md。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

