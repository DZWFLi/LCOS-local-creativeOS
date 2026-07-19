# Local Creative OS 项目绑定

> 状态：Active  
> 核验日期：2026-07-19  
> 状态源：本文件记录协作边界；产品、架构、Alpha Scope 与 Sprint 决策以 OS 仓库冻结文档为准。

## 1. 绑定目的

三个 Codex 深度链接只负责导航和来源定位，不会自动同步聊天记忆、仓库状态或任务进度。跨项目协作必须通过已批准的 Markdown Handoff、实际文件、Git 和运行证据完成。

## 2. 项目登记

| 项目 | Codex 深度链接 | 当前文件系统位置 | 角色 | 状态源 |
| --- | --- | --- | --- | --- |
| Local Creative OS | `codex://threads/019f7958-59f0-7833-bf02-288b90b4222a` | `E:\Codex 项目\OS开发` | 产品与开发总控 | OS 仓库冻结文档、Git、测试结果 |
| AdFrame 历史 Prototype | `codex://threads/019f69d0-f0f0-7612-98f1-8c6bb245a323` | 冻结旧仓库：`E:\Codex 项目\演示demo` | Review Prototype 与历史模块来源 | 旧仓库文件和 Git；不得成为新 App Shell 状态源 |
| AI Bridge | `codex://threads/019f462f-5bfb-7450-943e-2a40e0ca32c7` | 已知工作目录：`E:\Codex 项目\buddy协同测试` | Run 与执行基础设施来源 | Bridge 仓库、任务记录、事件和 Artifact Return 证据 |

补充来源：新 OS 仓库基线来自完整归档 `E:\Codex 项目\项目归档\AdFrame_Script_Review_Day3_2026-07-19.zip`；旧仓库保持不动。

## 3. 职责与边界

### 3.1 Local Creative OS

负责：

- README、AGENTS、PRD、UI Spec、ADR、Alpha Scope 与 Sprint；
- App Shell、Project Tabs、Project Canvas、Workspace、Artifact / View、Inspector；
- Local Core 边界、验收、风险和跨项目 Handoff；
- 汇总并复核 AdFrame 与 Bridge 的交付证据。

禁止：

- 依赖其他任务的聊天记忆作为产品真相；
- 未经 Handoff 批准直接修改 AdFrame 或 Bridge 仓库；
- 把旧 AdFrame 三栏界面延续为 OS App Shell；
- 把 Bridge 的 Run 状态混入 Canvas 视觉状态所有权。

预期输出：OS 冻结文档、Sprint 交付、审计报告和验收记录，统一回到本仓库 `docs/`。

### 3.2 AdFrame 历史 Prototype

负责提供：

- Review、Decision、Locked Elements、Script Version、Compare；
- Repository / Evaluator / Runtime Adapter 等历史实现证据；
- 可复用模块清单、耦合风险和迁移建议。

禁止：

- 作为新 OS 的产品、架构或 App Shell 状态源；
- 在只读审计任务中修改源文件、升级依赖或迁移代码；
- 把 Mock、CopyOnly 或占位能力描述为已接通能力。

预期输出：文件级可复用审计报告，通过指定 Return 路径交回 OS。

### 3.3 AI Bridge

负责提供：

- Run、Executor、Event、Changed Files、Artifact Return；
- `waiting_input`、Review、Retry、Cancel、Continue 与恢复能力；
- Codex / Buddy 执行链和结构化任务证据。

禁止：

- 管理 Canvas 坐标、Workspace 视觉、Preview 或 Inspector；
- 在审计任务中擅自改 Schema、重启服务或扩大监听范围；
- 用聊天汇报替代 Bridge 记录、文件和运行证据。

预期输出：Alpha Runtime Spine 的现状、缺口、契约与升级顺序审计，通过指定 Return 路径交回 OS。

## 4. 当前阶段

已完成：

- 从完整归档建立独立 OS Git 仓库，旧仓库保持不动；
- 建立新基线 Commit / Tag；
- 补齐 Sprint 0 的 lint、typecheck、unit test、build 与 smoke test 质量门。

已正式派发的只读审计：

1. AdFrame 可复用 Review 审计：`os-adframe-review-audit-20260719-001`；
2. Bridge Alpha Runtime Spine 审计：`os-bridge-runtime-spine-audit-20260719-001`。

两份 Return 完成并由 OS 复核后，才能冻结 Sprint 1 的迁移与接口范围。

可并行但不得提前开发的 OS 工作：维护契约草案、验收场景、测试夹具要求和风险清单。不得在审计返回前迁移历史模块或接入真实 Bridge Runtime。

## 5. 修改权限

- 本轮只允许修改 `E:\Codex 项目\OS开发\docs\coordination\` 与 `E:\Codex 项目\OS开发\docs\handoffs\`。
- 两份 Handoff 已于 2026-07-19 派发到对应 Codex 任务。
- 当前是 Codex 跨任务派发，不是 AI Bridge / Buddy 结构化任务；不得将上述 task ID 描述为 Bridge 队列任务。
- 任何目标项目写入都必须在获批 Handoff 中逐项列明。
