# LCOS Realtime Connection Audit

## 审计结论

变更前一个 Project 页面可同时创建 Arrange、Context、Workflow 三条 Presentation SSE；Agent 模式另建 Active Context SSE，并同时存在 Run polling。多标签页叠加 Vite HMR 后足以耗尽同源 HTTP/1.1 可用连接，使普通 PUT 排队超时。

## 当前连接所有权

| 状态域 | 当前 Web 物理来源 | 状态 |
|---|---|---|
| Presentation（Arrange/Context/Workflow） | `ProjectRealtime` → `/projects/:id/events` | 已统一 |
| WorkState / Active Context | 同一 ProjectRealtime | 已统一 |
| Run / Proposal | 同一 ProjectRealtime，收到 invalidation 后 GET 权威投影 | 已统一 |
| Legacy Presentation stream | Core 兼容端点存在，当前 Web 不消费 | Deprecated |
| Legacy Active Context stream | Core 兼容端点存在，当前 Web 不消费 | Deprecated |
| Run polling | 非 Agent 且 Work Rail 展开时保留；Agent 统一流期间禁用 | Recovery/legacy |
| Vite HMR | 开发工具连接 | 不属于业务实时层 |

## 约束

- 一个页面内同一 Project 无论 mount 多少 Surface，只允许一个 `ProjectRealtime` 实例和一条业务流。
- Project 切换最后一个 subscriber 离开后 abort 旧流。
- 当前尚未实现跨 tab leader；多标签暂为每页一条 Project 流，属于 Master Brief 明确允许的第一阶段 fallback。

## 调试

- Core：`GET /debug/realtime`
- Web 开发态：`window.__LCOS_REALTIME_DEBUG__`

