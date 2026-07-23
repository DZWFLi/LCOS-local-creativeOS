# Bridge Current State

> 证据边界：本轮未访问或修改 Bridge 仓库，只依据已交付的只读审计回传。分类是 OS 接入判断，不是 Bridge 新实现授权。

## 1. 分类矩阵

| 能力 | 当前事实 | 分类 | OS 接入要求 |
|---|---|---|---|
| Task 创建与持久化 | `task_<uuid8>`，真实 JSON 生命周期 | 需要兼容 Adapter | 新建 canonical `runId`，保留 `task_id` 映射 |
| Project / Session | 有 `project_id/session_id` 与复用 | 需要兼容 Adapter | 增加 canonical project root、binding、ContextSnapshot ref |
| queued/assigned/running/review/completed | 有真实状态与测试 | 可直接复用 | Adapter 归一为 Alpha Run 状态；executor 不能直接 completed |
| failed/timeout/cancelled | 部分实现，running cancel 仅请求 | 需要修改 | 明确终止确认、恢复与事件 |
| waiting_input | 不存在 | 需要修改 | 一等状态 + continueRun |
| Retry | 同一 task 重新排队并加计数 | 需要修改 | 新 attempt / lineage，保留旧证据 |
| Continue | 无独立输入继续 | 需要修改 | 仅 waiting_input 可继续，记录不可变输入事件 |
| changed_files | 路径/action 校验与回传存在 | 需要兼容 Adapter | 加 project-relative path、containment、before/after hash |
| artifacts | 有结构化保存与 task/project/session | 需要兼容 Adapter | 加 contentHash、target、revision、pending disposition |
| submit_result | 真实 WorkBuddy 回传链 | 可直接复用 | 仅作为 executor→Bridge 输入，不等于用户 Accept |
| MCP streamable HTTP | 传输存在 | 需要修改 | 不等于 Run Event SSE；需事件 ID、序列与 replay |
| Watcher inbox routing | 5 秒轮询、锁、claim/start | Alpha 后置 | 这是 WorkBuddy inbox，不是文件 Watcher 或通用 Runtime |
| Headless POC | E2E 有证据，但 companion 硬编码 | 需要重写 | 通用、项目受限、可恢复的 executor Adapter |
| externalThreadId | 无 durable 字段 | 需要修改 | Run 绑定后必需，不能从标题推断 |
| ContextSnapshot | 只有可变 generic context | 需要重写 | OS/Local Core 生成 immutable snapshot，Bridge 只引用 |
| Write lease | 不存在 | 需要重写 | Bridge 管 lease/state，Local Core 管 hash/watch |
| Restart recovery | JSON 持久化，缺重放与 reconciliation | 需要修改 | 非终态扫描、orphan 处理、幂等恢复 |
| Idempotency | 不存在 | 需要修改 | project 范围 idempotencyKey |
| Structured error | 主要是展示字符串 | 需要重写 | 稳定 code/retryable/details |
| Health | 有 health_check 与计数证据 | 可直接复用 | OS mode 需明确版本、能力和 endpoint |
| Metrics | 现有 metrics 记录 | 需要兼容 Adapter | 不泄露敏感 Context；不作为 Run 真相 |
| Loopback | 默认 127.0.0.1，但允许任意 host | 需要修改 | OS mode 强制拒绝非 loopback |
| 日志脱敏 | 未发现 | 需要修改 | 普通日志不写敏感 Context |
| GUI 项目 / Canvas | Bridge 不管理 | 可直接复用 | 保持边界，不把 Workspace/坐标塞入 Bridge |
| Buddy 深度接入 | 已有路径但不是 Alpha P0 | Alpha 后置 | Codex-only Runtime 合同稳定后再接 |

## 2. Task / Run / Session / Result 结论

```text
OS Command
  -> canonical RunId
  -> compatibility Bridge task_id
  -> Bridge session_id
  -> externalThreadId / worker id
  -> submit_result
  -> review_ready
  -> OS user Accept / Retry
```

- `task_id` 不是 canonical Run ID；
- Session 复用不等于 Conversation；
- `submit_result(review)` 不是 completed；
- Bridge result 中的文件/Artifact 只是回传证据，接受前保持 Pending；
- OS/Local Core 保存 Command、ContextSnapshot、Artifact/Revision 与用户接受。

## 3. 事件与恢复最低线

- 每 Run 单调 `sequence`；
- stable `eventId`；
- `afterSequence` 或 `Last-Event-ID` replay；
- 持久化 `waiting_input`、review、cancel 请求和确认；
- transport retry 不重复创建 Run；
- 重启后无法恢复的 Run 进入 `RECOVERY_REQUIRED`，不得静默 completed；
- POC 硬编码 companion 不进入生产 Adapter。

## 4. 不在本 Phase 做

不修改 Bridge，不创建 Runtime API，不启用 Watcher，不创建真实 Run，不写用户文件。此文只提供后续 Bridge owner 的兼容合同输入。
