# Artifact Protocol V3

## 目标

把当前“路径数组”升级成结构化产物，支持 review、追踪和后续任务引用。

## 当前冻结项

最小必填字段固定为：

```json
{
  "artifact_id": "",
  "task_id": "",
  "project_id": "",
  "session_id": "",
  "type": "",
  "name": "",
  "path": "",
  "summary": "",
  "created_by": "",
  "created_at": ""
}
```

## 类型建议

- `document`
- `presentation`
- `image`
- `video`
- `code`
- `spreadsheet`

## 设计原则

1. Artifact 是一等对象，不再只是 Task 的字符串附件
2. `summary` 用于让 Codex 快速判断是否满足交付目标
3. `path` 保留绝对路径，便于本地验证
4. 一个 Task 可以关联多个 Artifact

## 建议扩展字段

```json
{
  "mime_type": null,
  "role": "primary",
  "source_status": "generated",
  "tags": [],
  "updated_at": null
}
```

## 职责边界

### Bridge

- 保存 artifact 主数据
- 维护 `task_id -> artifact_ids`

### WorkBuddy

- 回传结构化 artifact
- 保证 `path`、`type`、`summary` 可用

### Codex

- 基于 artifact 判断是否验收通过
- 决定是否进入 `completed` 或 `retrying`

## 待实现点

1. 新增 `artifacts.json`
2. `submit_result` 支持结构化 artifact 数组
3. 兼容旧版纯路径数组输入
