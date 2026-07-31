# ADR — MVP 1.0 Runtime UI Closure

## 状态

Approved by Dz on 2026-07-29: reuse completed Bridge and Slice A–E; connect the remaining UI/runtime path as one batch.

## 1. 变更原因

Slice A–E 已完成 Canonical Run、Bridge Adapter、Result Ingestion 与 Review
生命周期，但 Local Core 启动入口、HTTP API 和 Web 主流程尚未接线。当前 Web 仍用定时器
模拟 Run，无法证明 MVP 1.0 的真实纵向闭环。

## 2. 变更前流程

```text
Web Command
→ 前端 RUN-* 演示 ID
→ 定时器 queued / running / waiting_input / review
→ 前端临时 Return
→ 前端 Accept

Local Core Slice A–E
→ 仅由测试直接调用
```

## 3. 变更后流程

```text
Web Command
→ POST Project Run
→ ContextManifestV0
→ Canonical Run + RuntimeDispatch
→ 现有 Bridge Adapter dispatch
→ WorkBuddy
→ Web 显式 sync
→ Result Ingestion
→ RunReview + Pending ArtifactReturn
→ Accept / Reject / Retry
→ Reload Project Truth
```

## 4. 用户操作变化

- `Cmd/Ctrl + Enter` 创建真实 Runtime Run；
- Work Rail 显示 canonical Run 与 Provider 状态；
- 用户点击刷新状态同步 Bridge；
- Return 到达后显示 Accept / Reject / Retry；
- 不再自动伪造 `waiting_input` 或 Artifact Return。

## 5. 数据流变化

Web 只提交 `instruction / targetArtifactId / workspaceId`。Local Core 自行构建并持久化
Manifest、Run、Dispatch 和 Binding。Bridge 外部 Task ID 不进入 Web Project Truth。
Changed Files 继续经过现有 Path Guard 和 Result Ingestion。

## 6. 影响模块

- `apps/local-core`: Runtime application service、启动装配、HTTP API；
- `apps/web`: Local Core client、RuntimeBridge、Work Rail 状态与决策；
- `packages/contracts`: 最小 HTTP input/output contracts；
- Tests: Runtime HTTP integration、Web client 与 UI state。

## 7. 文件与 Schema

不增加 Schema，不迁移数据库，不修改五张 Runtime 表。复用 Schema v6 与 Slice A–E
Repository。

## 8. 开发成本

一个连续集成批次：后端装配与 API、前端状态投影、Review 操作、集中 E2E。

## 9. 风险

- Bridge 或 WorkBuddy 未运行时 dispatch 进入 `recovery_required`；
- 当前执行器仍需真实 WorkBuddy 唤醒，不能宣传零点击自治；
- polling 先采用用户触发与有限前端轮询，不引入 SSE/Watcher；
- 只支持 Markdown Script 单输出；
- Provider `review` 不写入 canonical Run，UI 只读 presentation phase。

## 10. 验收条件

- 真 Run ID、Manifest、Dispatch、Binding 可重启恢复；
- Bridge 不可用有结构化错误与 recover 操作；
- review Result 生成 Pending Return 和 Draft Revision；
- Accept CAS、Reject、Retry New Run 从 UI 可操作；
- 原 Current 不被执行或摄取自动覆盖；
- Root quality chain、Runtime E2E 与浏览器 Golden Path 通过。

## 11. 回滚

Revert 本批次即可恢复到 Slice A–E 后端能力和 v0.7 静态 UI。Schema 与历史 Runtime
记录无需回滚；已创建的 Run 保留为审计证据。
