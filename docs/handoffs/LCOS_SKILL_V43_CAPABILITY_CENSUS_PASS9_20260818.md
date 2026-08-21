# LCOS Skill V4.3 · PASS9 Full-Stack Capability Census

日期：2026-08-18  
基线：PASS8 Desktop + Capture + V4.3 Skill upgrade

> 原则：Skill 可以先定义 route，但只有完整 Contract → Core → CLI/MCP → Review/GUI → Test 链真实存在时才标 READY。

| Route | 状态 | 当前真实能力 | 0.1 行为 |
|---|---|---|---|
| `context_build` | PARTIAL | Web 已有 `createContextFromMembersDirect`，Scope + Presentation 可持久化；Core 有 Presentation/Curation 基础能力 | Agent proposal-only；不伪造 Context-create CLI |
| `context_edit` | PARTIAL | 已有 Presentation patch、Curation patch、Context Snapshot compare/branch；GUI 可改 membership | 只允许已有安全路径；统一 review-gated Agent 写命令未冻结前 proposal-only |
| `workflow_build` | PARTIAL | Web 已有 `createWorkflowFromMembersDirect`，Workflow Presentation/Scope 可持久化 | Agent proposal-only；不伪造 Workflow-create CLI |
| `workflow_edit` | PARTIAL | Workflow GUI 可编辑成员/边/label；Presentation patch 可落状态 | 统一 review-gated Agent 写命令未冻结前 proposal-only |
| `filesystem_organize` | MISSING / DEFERRED | 没有 FileOrganizationPlan/Journal/Core Apply 正式能力 | 0.1 plan-only / fail-closed；不 shell move/rename |
| `handoff_continue` | READY | Continuity Runtime、SessionSummary、Handoff store/routes、Context History projection 均存在 | 可读取当前必要材料并生成 compact handoff；需要持久化时走现有 Handoff/Continuity |

## Huabu reorganize

当前真实链：

```text
ReorganizeProposal → preview/ghost → apply/reject → rollback
```

当前还没有完整：

```text
live Presentation ChangeSet
→ item-level before
→ per-item Keep/Revert
→ later-edit conflict guard
```

因此 V4.3 `review-change` policy 正确，但 0.1 必须继续 capability-gated fallback。

## Resolver Gate B

已在同步后的 full tree 实跑 11 个 Curator intents：

```text
ingest_conversation
ingest_capture_batch
reorganize
retrieve_for_task
update_existing_project
context_build
context_edit
workflow_build
workflow_edit
filesystem_organize
handoff_continue
```

全部能解析正确 `entry` 与独立 `load` 集合。

## Managed Install Gate D

已用临时 `CODEX_HOME` 实跑 `scripts/install-lcos-codex-skill.mjs`：7/7 managed skills 安装成功，`managed-by-lcos.json` / `sourceHash` 正常。

## 尚未在当前无依赖快照环境完成

`npm run test:architecture` 当前因源码包无 `node_modules`，`vitest: not found`，必须由联网完整工作树 bootstrap 后执行。
