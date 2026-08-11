---
name: lcos-project-curator
description: 把对话、文件、URL、当前 Selection 整理进 LCOS 项目——按 intent 路由，只加载必要模块。触发词：整理进 LCOS / 沉淀到 LCOS / 整理一下这张画布 / 整理刚才收的 / 根据当前这些继续。绝不创建 Managed Run。
role: agent
version: 2.0.0
---

# LCOS Project Curator V2（Indexed Skill Runtime）

## Scope

把对话 / 文件 / URL / Capture / Selection 整理进 LCOS：搜索已有内容、提炼高密度节点、导入资源、建立关系、整理 Presentation。

## Trigger → Intent 路由

先读 `skill.index.yaml`，按触发词匹配 intent，再加载该 route 声明的模块。**禁止**在没有 intent 时读全部模块。

| 触发词 | Intent |
| --- | --- |
| 整理这些对话 / 沉淀今天的讨论 / 把这几轮收进 LCOS | `ingest_conversation` |
| 整理刚才收的 / 把刚才这些 reference 收进项目 | `ingest_capture_batch` |
| 整理一下这张画布 / 归组重排 / 太乱了 | `reorganize` |
| 根据当前这些继续 / 按最新要求改 | `retrieve_for_task` |
| 把这份文档/这批文件补进现有项目 | `update_existing_project` |

加载方式：`lcos skill resolve lcos-project-curator --intent <intent> [--condition <name>...]`，或按 `skill.index.yaml` 的 `base_load` / `conditional_load` 手动加载。预算：`max_reference_files` / `max_reference_chars`，超预算必须说明为什么。

## Hard Redlines

1. Search before create：没搜过就建节点 = 违规。
2. 禁止 raw-message explosion：整场对话不逐条变节点；按章节/决策/待办提炼。
3. 绝不创建 Managed Run。
4. 不自动重排用户整个项目：reorganize 必须先出 proposal，用户确认后 apply；preserve manual pins。
5. Artifact 删除 = destructive，必须单独确认；Presentation 移除 ≠ 删除。
6. 不覆盖 manual/locked 标题；Agent 只允许 auto → direct update。
7. 不确定 Project：不弹强制选择器，走 staging（`lcos capture pending`）。

## 执行流程（通用）

```text
preflight（diagnostics/preflight.md）
→ route 流程
→ verify（diagnostics/verify-*.md）
→ 写 SkillTrace（lcos skill trace <json>）
```

## 每次结束

用 `lcos skill trace` 记录：route / loadedModules / cliCalls / createdIds / verifier / outcome。Trace 存 `~/.lcos/skill-learning/`，不是项目事实。
