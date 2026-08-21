# V0 → V1 Migration

Bridge SQLite Schema 从 1 升到 2：

```text
bridge_tasks.output_intent
```

旧 Task 自动标记：

```text
revise
```

迁移前生成：

```text
bridge.sqlite3.v1.bak
```

兼容规则：

- V0 Task 可读取；
- 已存在的 V0 Task 可提交 `bridge-result-v0`；
- 不允许创建新的 V0 Task；
- V1 Task 必须提交 `bridge-result-v1`；
- 不做自动 Legacy 重发。
