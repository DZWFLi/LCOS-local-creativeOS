# Project Event Runtime Design

## 边界

ProjectEventHub 是短期通知与恢复层，不保存 Project Truth、不决定 mutation、不构成 Event Sourcing 数据库。正确顺序始终是：

```text
Repository persist
→ publish ProjectEventEnvelope
→ Web 收到 invalidation
→ 按需 GET authoritative state
```

## Envelope

`ProjectEventEnvelope` 包含 `runtimeId / projectId / projectSeq / channel / type / origin / timestamp / payload`。`projectSeq` 只在一个 Local Core runtime、一个 Project 内单调；Core 重启以 `runtimeId` 变化表达，客户端必须 snapshot resync。

## Replay

Hub 默认每项目最多保留 2048 个事件、最多 2 分钟：

- cursor 仍在窗口内：replay `lastSeenProjectSeq` 之后事件；
- cursor 早于最旧事件或 runtimeId 不同：`snapshot_required`；
- snapshot 是权威仓库的版本摘要，不从 event buffer 反推 Truth。

## Transport

第一版使用 REST mutations + 单 Project SSE。业务 Store 只依赖 `ProjectRealtime` 分发，不直接依赖 EventSource/SSE；未来改 WebSocket 不需要重写 Store。

## 连接状态

`connecting → synced → recovering → synced`，外加 `offline`。旧事件忽略，序列 gap 立即中止当前 transport 并恢复，不能跳过缺口继续应用。

