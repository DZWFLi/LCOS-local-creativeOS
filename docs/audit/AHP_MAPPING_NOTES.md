# AHP Mapping Notes

## 直接化用

- serverSeq 的单调顺序思想；
- origin identity；
- 单物理连接承载多逻辑 channel；
- reconnect cursor；
- replay / snapshot fallback；
- confirmed / pending / optimistic 分层思想。

## LCOS 改写

- AHP `serverSeq` → LCOS Project-scoped `projectSeq`；
- AHP `ActionEnvelope` → `ProjectEventEnvelope`；
- AHP reconnect → SSE query cursor + bounded replay；
- AHP optimistic action → 现有 REST/CAS mutation + operation receipt + Presentation optimistic projection；
- AHP Host generation → Local Core `runtimeId`。

## 暂不照搬

- AHP Session ontology；
- 完整 AHP wire protocol；
- 所有业务对象改成 pure reducer action；
- durable event sourcing；
- WebSocket、CRDT、Kafka/Redis/NATS。

LCOS 仍然坚持：Project Truth 在现有 repositories；事件层只是可恢复的实时通知协议。

