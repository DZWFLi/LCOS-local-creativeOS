# Local Creative OS 跨项目交接协议

> 状态：Draft for approval  
> 适用项目：OS、AdFrame、AI Bridge

## 1. 核心规则

深度链接负责“去哪里”，Handoff 负责“为什么去、做什么、不能做什么、回来带什么”。链接本身不授予写权限，也不代表已经读取或同步目标任务的完整上下文。

跨项目事实优先级：

```text
实际文件与运行结果
→ Git Commit / Diff
→ Bridge 结构化任务与 Artifact 证据
→ 经核验的 Markdown 报告
→ Codex 对话摘要
```

对话中的“已完成”不能单独作为验收依据。

## 2. 状态所有权

| 状态 | 唯一所有者 | 其他项目如何引用 |
| --- | --- | --- |
| 产品、架构、Alpha Scope、Sprint | OS | 读取 OS 冻结文档和对应 Commit |
| 历史 Review Prototype 实现 | AdFrame 旧仓库 | 通过文件级审计引用，不反向覆盖 OS 决策 |
| Run、Executor、Event、Changed Files、Artifact Return | Bridge | 通过 Contract、任务记录和运行证据引用 |
| 创作内容与正式文件 | 文件系统 | 通过路径、哈希、Revision 和确认状态引用 |

## 3. 标准生命周期

```text
OS 起草 Handoff
→ Dz 批准或明确要求派发
→ OS 创建真实任务 / 发送目标任务消息
→ 目标项目按边界执行
→ 目标写回报告与证据
→ OS 复核文件、Git、测试和运行结果
→ 接受，或最多一次返工
→ 第二次仍不通过则停止并汇报
```

Draft Handoff 不会自动派发。目标变化、权限扩大、不可逆操作或范围冲突时必须停止。

## 4. Handoff 必填字段

每份正式 Handoff 必须包含：

- `handoff_id`：唯一交接编号；
- 源项目与目标项目的 Codex 深度链接；
- 固定 `project_id`；
- 唯一 `task_id`（真实 Bridge / Buddy 任务存在时必填）；
- 项目绝对路径；
- 目标、原因和输入；
- 允许读取与允许修改范围；
- 明确禁止事项；
- 交付文件绝对路径；
- 验收命令、证据和成功标准；
- 截止时间（若有）；
- Return 路径；
- `changed_files`、Artifacts 与当前状态。

没有真实 `task_id` 时写 `not_dispatched`，不得编造编号。

## 5. 命名与返回

- 发往目标项目：`TO_<TARGET>_<TOPIC>.md`；
- 返回 OS：`<TARGET>_<TOPIC>_RETURN.md`；
- OS 最终验收：`<TOPIC>_ACCEPTANCE.md`；
- 审计报告放在 `docs/audit/`，派单草案放在 `docs/handoffs/`。

Return 至少包括：任务摘要、实际范围、修改文件、检查命令与真实结果、证据路径、Mock / 未接通项、风险、未完成项和建议下一步。

## 6. 权限与冲突

- 默认只读；任何写权限都必须精确到仓库和目录。
- 一个 Handoff 不得同时允许多个执行者修改同一核心文件。
- 目标仓库不干净、发现敏感信息或分支不明时停止。
- 不自动 Push、不改写历史、不强制重置、不静默覆盖用户文件。
- AI 输出默认是 Draft / Pending；用户确认前不得覆盖人工 Current。
- Bridge 与 OS 同时涉及文件时，由 Local Core / 文件系统哈希与写租约规则裁决，不以最近一次聊天归因。

## 7. 验收与返工

OS 主控必须亲自检查：

1. 交付文件存在且内容对应当前代码版本；
2. Git 状态、Commit 与 Diff 符合任务范围；
3. lint、typecheck、test、build、smoke 中适用项的真实结果；
4. 关键交互、Runtime 或 API 证据；
5. Mock、占位、未接通和阻塞被明确标记；
6. 没有越过产品、架构和写权限边界。

首次不通过可发出一次带失败证据的返工续单。第二次仍不通过、目标变化或风险上升时停止自动往返，由 Dz 决定。

## 8. 当前派发状态

两份 Handoff 已于 2026-07-19 通过 Codex 跨任务消息正式派发：

- AdFrame：`os-adframe-review-audit-20260719-001`；
- Bridge：`os-bridge-runtime-spine-audit-20260719-001`。

这两个编号是 OS 协调任务编号，不是 AI Bridge / Buddy 队列中的 `task_id`。本次只读审计仍然禁止修改目标项目仓库，不实施迁移、Runtime 接入或新功能。
