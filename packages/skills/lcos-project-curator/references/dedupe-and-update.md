# 去重与更新

## 流程

```text
1. lcos search 目标主题（含 --related 查看邻居）
2. 命中相似节点 → 读该节点（node read）
3. 判断：
   - 语义等价 → reuse（加关系/引用，不新建）
   - 同一主题持续沉淀 → update（追加/修正，不覆盖用户手写关键内容）
   - 新角度 → create
```

## V2：语义检索候选

search 现在会返回：

```text
FTS 命中（含 derived search documents）
Vector 命中（Ollama 可用时，语义近邻）
1-hop Relation 邻居（--related）
```

这些只是候选。

> 相似 ≠ 相同。

Agent 仍必须自己决定 reuse / update / new / ignore。向量相近的两个节点可能表达完全不同的意图，必须在读内容后判断。

## 重复判据

```text
标题近义 + 内容表达同一结论 → 重复
标题近义但结论/范围不同 → 不是重复，考虑关系
```

## 安全

不确定时新建，不合并。
