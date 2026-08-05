# LCOS Light Bridge Kernel v0.3.0

这是 Local Creative OS 的轻量任务网关。它只负责：

```text
LCOS Run
→ Provider Task
→ WorkBuddy / Codex
→ ResultEnvelope
→ LCOS Result Ingestion
```

它不负责 Project Truth、Artifact、Revision、Current、Accept，也不负责替用户判断 Target。人类已经制造了足够多的“万能中间层”，这里不再添一只。

## v0.3.0 的边界收口

- 删除 Bridge MCP 公共面，只保留 loopback REST；
- 删除 Session Continuity / Conversation 模型，项目会话绑定归 Local Core；
- Executor MCP 由 Local Core 暴露并代理 Bridge REST；
- 保留 Task Lease、waiting_input、ResultEnvelope 与重启恢复。

## v0.2.0 的核心变化

Run 不再默认等于“修改一个旧文件”。Bridge 现在理解三种产出意图：

```text
create   新建 1–5 个文件
revise   修改一个已有内容，但输出仍写隔离副本
analyze  返回结构化结论，可以零文件完成
```

流程：

```mermaid
flowchart LR
    LCOS[Local Core 冻结 Context 与 Output Intent]
    --> TASK[TaskEnvelopeV1]
    TASK --> BRIDGE[Light Bridge Task Plane]
    BRIDGE --> PROVIDER[WorkBuddy / Codex]
    PROVIDER --> RESULT[ResultEnvelopeV1]
    RESULT --> CORE[Local Core Result Ingestion]
    CORE --> REVIEW[Pending Return / Run Review]
```

## 为什么 TaskEnvelopeV1 多了 outputRoot

改造方案允许 Provider 返回额外文件。如果只有 `allowAdditionalFiles=true`，却没有一个明确的隔离输出根，Bridge 就无法判断“额外文件”是正常产物，还是 Agent 顺手把桌面也改了。

因此 V1 增加：

```text
outputRoot
```

Bridge 做第一层词法范围检查，Local Core 继续做最终的 realpath、junction、Hash 和 Project Path Guard。

## 安装

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

设置 Runtime Root：

```powershell
$env:LCOS_BRIDGE_RUNTIME_ROOT = "$env:USERPROFILE\.lcos-bridge-runtime"
```

检查：

```powershell
lcos-bridge doctor
```

启动：

```powershell
lcos-bridge serve --host 127.0.0.1 --port 43122
```

只允许 loopback，不允许 `0.0.0.0`。

## 创建任务

```powershell
lcos-bridge task create --file examples/task-envelope-create.json
```

Provider 认领：

```powershell
lcos-bridge task claim-next --provider workbuddy --worker buddy-local
```

提交结果：

```powershell
lcos-bridge task submit-result --file examples/result-envelope-create.json
```

## 合同规则

### create

- 不需要旧 Artifact Target；
- 只接受 `action=created`；
- 默认不允许零文件；
- 最多 5 个文件；
- 可声明固定文件，也可在 `allowAdditionalFiles=true` 时从 `outputRoot` 返回额外文件。

### revise

- Target 与 Base Revision 由 Local Core 冻结，Bridge 不判断；
- 必须恰好返回一个 `action=modified` 文件；
- 文件仍位于隔离输出目录；
- Bridge 不覆盖源文件。

### analyze

- 必须允许零文件；
- `summary` 是正式结果；
- 可提供 warnings 与 suggestedNextActions；
- 即使返回分析附件，是否转成 Artifact 仍由 Local Core 决定。

## 幂等

相同：

```text
lcosRunId + idempotencyKey + requestFingerprint + payloadFingerprint
```

返回原 Task。

同一个 Run 携带不同请求，返回：

```text
IDEMPOTENCY_CONFLICT
```

## V0 兼容

- 不再允许创建新的 `bridge-task-v0`；
- 数据库升级后，旧 V0 Task 仍可查询、提交旧 Result、Finalize；
- 不存在“V1 失败后自动重发 V0”的危险回退。

## REST

Bridge 只提供内部 loopback REST：

```text
GET  /health
GET  /v1/capabilities
POST /v1/tasks
GET  /v1/tasks/by-run/{lcosRunId}
POST /v1/tasks/{taskId}/result
```

MCP：

```text
Bridge 不提供 MCP；执行器工具通过 Local Core 的 `lcos-executor` MCP 调用 REST 网关。
```

## Codex pull worker

`run-once` 原子认领一个 Codex Task、建立租约并进入 running，然后把完整 Task Envelope 输出给本地 Agent：

```powershell
lcos-bridge worker run-once --provider codex --worker codex-local
lcos-bridge worker heartbeat --task-id <task-id> --worker codex-local
```

长期值守使用 `worker watch`。租约过期后任务可以被其他 worker 重新认领；`attemptCount` 会递增。该命令只负责可靠取件，不会静默启动或操控 Codex GUI。

## 测试

```powershell
pytest
python -m compileall src
python -m build
```
