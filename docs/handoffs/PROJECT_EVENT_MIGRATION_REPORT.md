# Project Event Migration Report

## 已迁移

- Contracts：Project Event / Origin / Snapshot / Reconnect / Mutation Receipt。
- Core：ProjectEventHub、bounded replay、runtimeId、ProjectMutationCoordinator。
- Route：`GET /projects/:id/events`、mutation receipt、`/debug/realtime`。
- Event source：Presentation、semantic WorkState、Run、Proposal。
- Web：ProjectRealtime transport/dispatcher；Presentation 与 Agent/Active Context 均改用统一流。
- WorkState：camera / zoom / visibleNodes 继续保存为可丢失运行态投影，但不推进 semantic version、不发布 semantic event。
- AI：HTTP abort signal 穿透 Attention → Intelligence provider fetch；fallback 共用总 deadline。

## 兼容入口

Legacy Presentation SSE 与 Active Context SSE 暂时保留，当前 Web 已无调用。删除 Gate：真实浏览器压力与至少一个版本兼容观察通过后移除。

## 未迁移

- Graph/Artifact 等所有 mutation 的 operation receipt 全覆盖；
- 跨 tab `BroadcastChannel + navigator.locks` leader；
- durable pending mutation queue（本轮明确不做）；
- Full Event Sourcing / CRDT（明确不做）。

## 回滚

无 Schema migration。旧 SSE route 保留，可逐文件回滚 Web dispatcher 与 Core Hub；不得用 `reset --hard`。Project Truth 数据无需转换。

## 浏览器验收阻塞

当前工作树包含本轮未提交改动，官方 launcher 按规则拒绝启动。未获 commit 授权前不绕过 launcher、不用旧进程冒充新代码测试。开发栈仍处于停止状态。
