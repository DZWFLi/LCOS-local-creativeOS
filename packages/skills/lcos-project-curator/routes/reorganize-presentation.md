# Route: reorganize

## 流程

```text
read current Presentation（members/hierarchy/pins/emphasis）
→ read Selection / relevant nodes（有值才读）
→ analyze（重复、孤岛、密度、层级）
→ proposal（ReorganizeProposal：merge/remove/delete/hierarchy/emphasis/layoutIntent）
→ ghost（Before → After，用户看效果不读坐标 JSON）
→ user accept
→ apply（POST .../reorganize/proposals/:id/apply）
→ verify
```

## 硬规则

- preserve manual pins：layoutIntent.preservePinned=true 默认；用户明确"全部重排"才允许覆盖。
- Artifact 删除单独确认（confirmDestructive=true）；Presentation 移除不需要。
- snapshot 存在：apply 前服务自动存快照，apply 后可 rollback。
- Agent 不算坐标：只交 members/hierarchy/语义分组/pinned/emphasis/engine 偏好。

## 条件加载

- 涉及删除 → `policies/destructive-change.md`
- 关系密度 → `policies/relation-density.md`
