# Mutation Recovery Report

## 已实现

- Web installation `clientId`：localStorage 中仅保存非敏感 UI identity。
- 每个 document/tab `sessionId`。
- 每次 mutation 单调 `clientSeq` 与预先生成的 `operationId`。
- Presentation 与 WorkState 事件携带 origin。
- `ProjectMutationCoordinator` 在当前 runtime 内提供有界、TTL receipt。
- duplicate operationId 返回原 receipt，不重复 persist、不重复 version bump、不重复发布业务事件。
- `GET /projects/:projectId/mutations/:operationId` 可确认 timeout-after-commit。
- Presentation transport failure 先查 receipt；存在则确认原提交，而不是显示 remote conflict。

## 语义区分

```text
HTTP timeout / abort → uncertain
receipt found → confirmed
receipt absent → authoritative GET / safe rebase
CAS + foreign origin → true conflict
runtimeId changed → receipt 不再可信，snapshot required
```

## 未完成

- 所有 Graph/Artifact/Run mutation 尚未全部接入 coordinator。
- UI 已具备六态类型与主要文案，但 Presentation notice 尚未统一成全局 pending-mutation store。
- own-event correlation 已具备 origin 数据，尚未把所有旧冲突提示统一改由 origin 判定。

