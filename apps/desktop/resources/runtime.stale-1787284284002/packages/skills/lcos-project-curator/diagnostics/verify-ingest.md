# Diagnostic: Verify Ingest

检查：

- 每个新节点独立可读、有来源
- 无 raw-message explosion（节点数远小于消息数）
- 无重复节点（search 复查）
- provenance 存在
- 未创建 Managed Run

失败 → 记录 correctionRefs 并修正。
