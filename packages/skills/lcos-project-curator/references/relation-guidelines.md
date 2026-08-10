# 关系规则

## 目的

下次人或 Agent 点一个节点时，容易知道它和什么有关。

## 限制

```text
只连未来有阅读价值的关系
不做 all-to-all
不因为两个节点在同一对话就强连
```

## Agent 关系元数据

```json
{
  "origin": "agent",
  "createdBy": "codex",
  "confidence": 0.7,
  "evidenceRefs": [{ "kind": "conversation", "id": "<session-id>" }]
}
```

来源是对话/文件时尽量写 evidenceRefs。
