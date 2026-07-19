# TO_BRIDGE_ALPHA_RUNTIME_SPINE

> status: `draft_not_dispatched`  
> handoff_id: `OS-BRIDGE-RUNTIME-SPINE-001`  
> project_id: `local-creative-os`  
> task_id: `not_dispatched`

## 目标项目

- Source / Coordinator：`codex://threads/019f7958-59f0-7833-bf02-288b90b4222a`
- Target：`codex://threads/019f462f-5bfb-7450-943e-2a40e0ca32c7`
- 已知 Bridge 工作目录：`E:\Codex 项目\buddy协同测试`
- OS 仓库：`E:\Codex 项目\OS开发`

## 任务目标

只读审计 Bridge 当前真实能力与 Local Creative OS Alpha Runtime Spine 的差距，给出可验证的前置升级顺序与 Contract 建议。

本任务不是升级实施，不接通 OS，也不创建真实 Run。

## 输入

- Bridge 仓库代码、配置、测试与 Git；
- `E:\Codex 项目\buddy协同测试\AI_Bridge_当前技术进展与ContextPack评估稿.md`；
- OS 的 `README.md`、`AGENTS.md`、冻结 PRD / UI Spec 和相关 ADR；
- `E:\Codex 项目\OS开发\docs\coordination\CROSS_PROJECT_HANDOFF_PROTOCOL.md`。

## 审计范围

- `createRun` 与 Run 身份；
- `queued / running / waiting_input / review / completed / failed / cancelled`；
- Event / SSE 或等价实时事件；
- Changed Files、Artifacts 与 Artifact Return；
- Retry、Cancel、Continue；
- `externalThreadId`、项目根目录与 Context Snapshot；
- 写租约、写前哈希校验和冲突进入 `waiting_input`；
- 重启恢复、幂等、错误结构、日志脱敏与本机监听边界。

## 允许

- 只读检查 Bridge 项目文件、Git 和既有运行证据；
- 运行不改变服务、数据和依赖的现有诊断命令；
- 在正式派发后，仅写回下面指定的 OS Return 报告。

## 禁止

- 修改 Bridge 或 OS 代码；
- 新建或迁移数据库 Schema；
- 安装依赖、启动后台值守、重启服务或创建真实执行任务；
- 开放局域网 / 公网监听；
- 设计 Canvas 坐标、Workspace 视觉、Preview 或 Inspector；
- 用文档设想冒充已运行能力；
- 创建 Commit、Tag、Branch 或 Push。

## 交付

正式派发后的唯一写入路径：

`E:\Codex 项目\OS开发\docs\audit\BRIDGE_ALPHA_RUNTIME_SPINE_AUDIT_RETURN.md`

报告必须包含：

1. 当前真实能力矩阵，区分 Real / Partial / Mock / Missing；
2. OS Alpha 所需的最小 Runtime Contract；
3. 状态迁移图及非法迁移；
4. Changed Files / Artifact Return 数据结构建议；
5. 文件冲突、取消、重试和恢复策略；
6. OS、Bridge、GUI、Local Core 的所有权边界；
7. 最小升级切片、依赖、测试和回滚点；
8. 每条结论对应的代码路径、命令和运行证据；
9. 阻塞项与需要 Dz 决策的事项。

## 验收

- Bridge 与 OS 仓库除 Return 报告外无变化；
- 报告明确区分已有能力和建议能力；
- Contract 足以支持 OS 冻结 Sprint 1 接口范围，但不越权实现；
- 状态机覆盖 `waiting_input`、review、失败、取消和恢复；
- 安全边界包含 `127.0.0.1`、凭证、日志与文件写冲突；
- 所有关键结论都有实际证据。

## 截止时间

未设定；正式派发时补充。

