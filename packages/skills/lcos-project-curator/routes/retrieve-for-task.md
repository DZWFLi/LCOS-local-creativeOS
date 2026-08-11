# Route: retrieve_for_task

## 流程

```text
读当前 Selection / 任务目标
→ search（相关节点/文件/对话章节）
→ read bounded（只读必要 body）
→ 组装最小上下文（related 1-hop ≤5，避免全图）
→ verify（每个引用都有出处）
```

## 硬规则

- 不进入 Curator write path：不建节点、不写关系。
- context-budget：能少读就少读；未命名对象靠 body/source 检索。
- 不创建 Managed Run。
