# MCP 面政策（CLI-first，2026-08-06）

## 原则

```text
CLI 能做的，MCP 不做；MCP 只保留 CLI 做不到的 Agent 会话原生能力。
```

判定“能否进 MCP”的三个问题：

1. CLI 做不到吗？（批处理/导入/导出/维护/会话绑定/资源枚举 → CLI）
2. Agent 会话里会主动调用吗？（不会 → 不进工具面）
3. 需要实时、状态变更或结构化返回吗？（这是 MCP 的强项）

## 当前暴露面

- Agent（local-creative-os）：45 个工具（`ACTIVE_AGENT_TOOL_NAMES` 白名单），
  按域：project 4 / canvas 6 / context 5 / run 14 / resource 5 / conversation 11。
- Executor（lcos-executor）：8 个工具，物理独立文件
  `tools/lcos-agent/executor-tools.mjs`（claim/start/heartbeat/fail/get-task/
  get-context/request-input/submit）。

## 已降级/删除（保留 Core 路由，CLI 或内部使用）

```text
open_lcos（URL 由项目数据提供）
set_lcos_viewport（并入 focus/select）
get_lcos_canvas_observation（并入 active-context snapshotRef）
workspace 成员 list/add/remove/move（4）
provider 会话 get/set/clear（3）
propose_lcos_run（Agent 用 validate + create）
build_lcos_context_manifest（create 时自动冻结）
conversation export/rename/refresh/import-manual（CLI 已有）
resource list/describe（CLI 已有）
list_lcos_runtime_providers（CLI providers）
list_lcos_pending_runs（list_lcos_runs 覆盖）
executor 旧平行面 claim/start/cancel/task-by-run（并入 run 命名空间）
```

## 收益（schema token/轮）

- Agent：~5.6K → ~3.8K（65 → 45）
- Executor：~0.7K → ~0.5K（12 → 8）
- 每轮固定上下文约省 2K token

## 新增工具准入

新工具必须过上面三个问题，并同时给出 CLI 对应命令或明确说明“为何必须 MCP”。
进入白名单需更新本文件与 `tools/lcos-agent/mcp-server.mjs` 的
`ACTIVE_AGENT_TOOL_NAMES` / `executor-tools.mjs`。
