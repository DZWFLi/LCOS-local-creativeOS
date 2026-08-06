---
name: lcos-project-context
description: Read one LCOS Project + Workspace canvas context, turn the user's natural-language request into a structured Agent Plan, and execute through Local Core/Light Bridge without bypassing Draft Review. Use for ordinary agent sessions working on an LCOS project; executor turns use lcos-executor-run.
role: agent
estimatedTokens: 700
readOrder: ["references/agent-plan.md", "references/context-changes.md"]
---

# LCOS Project Context

## 何时用 / 何时不用

用：普通 Agent 会话里用户在 LCOS 项目上工作（画布/上下文/发任务/对话导入/Obsidian）。
不用：消息以 `LCOS 接单提示` 开头——那是执行器回合，去读 `lcos-executor-run`。

## 最小流程

```text
1. bind_lcos_project(projectId, workspaceId?)
2. get_lcos_active_context(projectId, workspaceId?)
   用户还在动时，每回合 watch_lcos_active_context(afterVersion) 一次
3. 只读任务需要的 Artifact/Revision 内容
4. 生成 AgentExecutionPlanV1（意图/目标/参考/结果策略见 references/agent-plan.md）
5. validate_lcos_agent_plan(projectId, plan)
   结构化错误按 references/structured-error-repair.md 自动修复一次
6. create_lcos_run → dispatch_lcos_run → 等待 Review
   结果由用户 Accept/Reject/Retry，绝不自动 Accept
```

## 章节目录

| 章节 | 文件 | 什么时候读 |
|---|---|---|
| 所有权边界 | references/ownership-boundaries.md | 任何变更前确认“谁拥有什么” |
| 读画布上下文 | references/visual-context.md | 解读选择/视口/节点/预览时 |
| 生成 Agent Plan | references/agent-plan.md | 每次发 Run 前（必读） |
| 上下文指令 | references/context-changes.md | 用户说“把X加进参考 / 别参考X”时 |
| 结构化错误修复 | references/structured-error-repair.md | validate 失败时 |
| waiting_input | references/waiting-input.md | 任务需要用户回答时 |
| 对话导入/检索 | references/conversation-import.md | 导入或搜索历史对话时 |
| Obsidian | references/obsidian.md | 用户要求连接 Obsidian 时 |
| 结果生命周期/输出安全 | references/output-and-lifecycle.md | 提交/接受/回滚相关 |

## 硬规则

1. Core 是唯一事实源；Web/CLI/MCP 只是适配器，绝不直接写 SQLite。
2. Accept 是唯一改变 Current 的路径；AI 结果在确认前永远是 Draft/Pending。
3. 只写 outputRoot；不覆盖源文件；取消后迟到结果只留审计。
4. 自然语言只用来理解意图，不重写契约；意图/目标/参考由 Agent Plan 显式表达。
5. 上下文命令基于最新 ActiveContext（version CAS）；冲突时重读一次重建，不猜 stale ID。
6. 工具不存在就说不可用，不发明工作流；Mock/Fixture 必须如实标注。
7. 执行器回合（接单提示）不读本 Skill。
