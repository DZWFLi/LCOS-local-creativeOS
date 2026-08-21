# LCOS 实时同步同根风险：变更协议（2026-08-15）

## 1. 变更原因

当前 Web 在同一 Project 页面分别为多个 Presentation、Active Context 和 Run 建立常驻 SSE/轮询；叠加 Vite HMR 与多标签页后，会竞争浏览器同源 HTTP/1.1 连接，导致普通保存请求排队并最终超时。断流、写入超时和乱序响应目前也缺少统一、可见、可恢复的语义。

## 2. 变更前流程

```text
Context Presentation SSE ─┐
Workflow Presentation SSE ├─ 同源连接池 ──┐
Arrange Presentation SSE ─┤               ├─ 保存 PUT 排队/超时
Active Context SSE ───────┤               │
Run Polling ──────────────┘               │
Vite HMR ─────────────────────────────────┘

断流 → 静默忽略
写超时 → 丢弃 pending intent / ready=false
旧 GET 晚到 → 可能覆盖新状态
```

## 3. 变更后流程

```text
Project 页面
   └─ 单一 Project Event Channel（页内按 projectId 复用）
        ├─ presentation change
        ├─ active-context / proposals / runs
        └─ reconnect → authoritative snapshot → resume

语义写入 → operationId → CAS 保存
   ├─ 成功：synced
   ├─ 冲突：拉权威快照并安全重放一次
   └─ 结果未知：write_uncertain → 拉权威快照判定 → 恢复或明确失败

应用远端状态：只接受 version > committedVersion
隐藏标签页：暂停网络流；重新可见：重连并全量校准
```

## 4. 用户操作变化

- 用户操作路径不变；保存不再因后台实时流占满连接而频繁超时。
- 网络短断时界面进入 recovering，而不是静默假装同步正常。
- 写入结果未知时保留用户意图并校准，不直接吞掉操作。
- 标签页重新可见时自动同步到权威状态，无需刷新。

## 5. 数据流变化

- Web 从“每个 Presentation 一条 SSE”改为“每个 Project 页面一条共享事件通道”。
- 事件只用于失效通知与恢复触发；Project Truth 仍由现有 GET/PUT 与 SQLite 权威存储提供。
- 版本在应用时强制单调递增，迟到响应不得回滚本地状态。
- 本轮不把 viewport 高频变化升级为 Project Truth；语义写入与相机瞬态继续分离审计。

## 6. 影响模块

- `apps/local-core`：Project 事件路由、事件汇聚、既有变更源接入。
- `apps/web/runtime`：共享事件连接、重连/可见性恢复。
- `apps/web/state`：Presentation 单调应用、失败恢复与同步状态。
- `apps/web/App.tsx`：Active Context/Run 改用共享通道，移除健康状态下的竞争轮询。
- 测试与 handoff/audit 文档。

## 7. 文件与 Schema 迁移

- 不新增数据库表，不修改 Project/Workspace/Artifact/Run Schema。
- Event sequence 为进程内传输序号；重连必须获取权威快照，因此不把它伪装成持久化事件日志。
- 保留旧 SSE 端点作为兼容入口，但当前 Web 不再为每个视图分别消费。

## 8. 开发成本

- 中等：增加共享连接层并替换三个 Presentation 流与 Active Context/Run 的重复消费。
- 中等：补充乱序、断流恢复、隐藏标签页和写入不确定性测试。

## 9. 风险

- 共享通道若实现错误，会同时影响多个实时域；因此断流必须退化为显式 recovering + snapshot resync。
- 内存 event sequence 在 Local Core 重启后归零；客户端不得把它当持久化版本。
- 旧端点保留期间存在双通道误接风险，需用测试确保 Web 只建立一个 Project 事件流。

## 10. 验收条件

1. 一个 Project 页面无论开启多少 Capability，只建立一条业务 SSE。
2. 多标签页、Vite HMR 存在时，Presentation/Active Context 保存仍能完成。
3. SSE 断开后显示 recovering，重连先拉权威快照，再恢复 synced。
4. 旧版本远端响应不能覆盖新 committed version。
5. 写超时后用户 intent 不被静默丢弃，并能通过权威快照判断成功/重放/失败。
6. 隐藏标签页停止业务 SSE/轮询；回到前台自动恢复。
7. `lint → typecheck → unit test → build → smoke test` 通过，并完成真实浏览器多标签压力手操。

## 11. 回滚方案

- 代码回滚：逐文件恢复 Web 到既有 `streamPresentation` / `streamActiveContext` 消费，移除 Project Event Channel；旧端点始终保留，回滚不需要数据迁移。
- 运行回滚：停止开发服务后用上一提交重新启动。
- 数据回滚：本轮无 Schema 变更；不得删除或重写现有 Project 数据。

## 本轮范围边界

本轮优先关闭导致“保存失败”的同根连接竞争，以及直接相关的断流恢复、单调版本和写入不确定性。Attention provider 的端到端取消传播与跨 provider 总 deadline 若无法在同一可审查批次安全完成，将保留为明确未完成项，不用局部 timeout 冒充关闭。
