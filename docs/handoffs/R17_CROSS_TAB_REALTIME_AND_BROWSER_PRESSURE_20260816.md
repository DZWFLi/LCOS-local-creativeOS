# R17 Cross-tab Realtime + Browser Pressure Handoff

## 任务摘要

完成 ProjectRealtime 跨标签共享、真实浏览器压力验收、Leader 接管与 Local Core 断线恢复。

## 实际范围

- Web Locks：按 Project 竞争唯一实时流 Leader。
- BroadcastChannel：Leader 向 Followers 广播 snapshot、event、cursor/state heartbeat。
- 不支持跨标签协调能力时退回每页一条 Project 流。
- Local Core 临时不可用时，App 初始化从一次性失败改为有限指数退避重试。
- 未修改 Project Truth、Presentation/Mutation schema、Canonical Canvas 坐标语义。

## 变更流程

```text
变更前：Tab A SSE + Tab B SSE + Tab C SSE → Local Core
变更后：Tab A/B/C Surface → ProjectRealtime → elected Leader SSE → Local Core
                                      └→ BroadcastChannel → Followers

Core 重启：offline/recovering → launcher restart → boot retry → snapshot → synced
```

## 修改文件

- `apps/web/src/runtime/projectRealtime.ts`
- `apps/web/src/App.tsx`
- `apps/web/tests/projectRealtime.test.ts`
- `docs/audit/REALTIME_REGRESSION_MATRIX.md`
- `docs/OPEN_DEBTS.md`

## 真实浏览器证据

- 官方 launcher：Web/Core/Bridge 全部健康，Core 自动重启计数按故障注入推进，Web/Bridge 未重启。
- 同一 Project 三标签：2 Followers `physicalStreams=0`，1 Leader `physicalStreams=1`。
- 60 次三标签交替真实鼠标拖动：三页均为“已保存”，无新增 Console error。
- 压力结束三页 `runtimeId` 相同、`lastSeenProjectSeq=587`。
- 关闭已识别 Leader 后继续写入：剩余标签同步从 seq 587→588。
- 终止 Local Core 监听进程后：官方 launcher 自动恢复；runtimeId 变更，双标签回到 synced；恢复后写入 seq 0→1。

## 自动检查

- ProjectRealtime 单测：3/3 PASS（含 lock-holder leader）。
- lint：PASS，无 error；仓库既有 warning 保留。
- typecheck：Web / Local Core / Domain / Contracts 全部 PASS。
- unit：Web 455/455；Local Core 419/419；Domain 10/10；Contracts 6/6。
- production build：PASS（既有 chunk-size warning）。
- smoke：PASS，20 个构建资源且 React root 存在。

## 风险与边界

- Web Locks 或 BroadcastChannel 不可用时会增加连接数，但不会失去实时能力。
- 不实现 durable offline mutation queue、CRDT 或跨浏览器进程唯一 Leader。
- Core 重启会产生新 runtimeId 与新的 projectSeq 起点；客户端必须以 snapshot 为权威，不跨 runtime 比较 seq。

## 回滚

可独立回滚 `projectRealtime.ts` 的跨标签协调，恢复每页一条统一 Project 流；App 启动重试可单独回滚。无 Schema migration，无 Project 数据转换。
