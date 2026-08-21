# Realtime Regression Matrix

| Gate | 结果 | 自动证据 |
|---|---|---|
| 每项目 projectSeq 单调 | PASS | `project-event-hub.test.ts` |
| Project 隔离 | PASS | 同上 |
| replay retained suffix | PASS | 同上 |
| gap/runtime restart snapshot | PASS | 同上 |
| subscriber cleanup | PASS | 同上 |
| 多 Surface 一页一物理流 | PASS | `projectRealtime.test.ts` |
| old event ignored | PASS | 同上 |
| sequence gap recovering | PASS | 同上 |
| duplicate operationId | PASS | coordinator + HTTP integration |
| persist failure 无 receipt | PASS | coordinator unit |
| project stream snapshot + ordered event | PASS | Presentation HTTP integration |
| late old Presentation GET 不回滚 | PASS | `presentationViewState.test.ts` |
| timeout receipt recovery | PASS（协议/HTTP） | receipt endpoint + Session recovery path |
| camera/visibleNodes 不推进 semantic version | PASS | `active-context-store.test.ts` |
| Pin 推进 semantic version | PASS | 同上 |
| Attention abort 到 provider fetch | PASS | intelligence provider test |
| provider chain total deadline | PASS | intelligence provider test |
| 三标签 leader-only | PASS | Web Locks + BroadcastChannel；真实浏览器 3 标签为 1 Leader / 2 Followers，Follower 物理流为 0 |
| Leader 标签关闭接管 | PASS | 关闭已识别 Leader 后，其余标签继续收到广播；后续写入 seq 587→588 |
| Local Core 重启恢复 | PASS | 官方 launcher 自动重启 Core；runtimeId 更新，双标签恢复 synced，恢复后写入 seq 0→1 |
| 60–120 秒真实浏览器压力 | PASS | 同 Project 三标签交替 60 次真实鼠标拖动；均回到已保存、无新增 Console error、最终 seq 一致 |

本轮专项：ProjectRealtime 3/3；Web typecheck 通过；真实浏览器证据见 `docs/handoffs/R17_CROSS_TAB_REALTIME_AND_BROWSER_PRESSURE_20260816.md`。全量门禁结果以该 Handoff 为准。
