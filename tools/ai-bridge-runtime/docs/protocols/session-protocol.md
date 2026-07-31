# Session Protocol V3

## 目标

定义 Project 与 Task 之间的稳定执行上下文层，避免每个任务都变成独立上下文。

## 当前冻结项

1. `session_id` 是 Bridge 主概念
2. `conversation_id` 是可选映射字段，不是必填
3. Bridge 只管理 Session 元数据
4. WorkBuddy 管自己的 Conversation 生命周期

## 设计原则

1. 一个项目优先复用一个长期主 Session
2. Task 默认绑定已有 Session
3. watcher 负责复用或补建 Session 元数据
4. Bridge 不依赖 WorkBuddy 内部 conversation 机制

## 建议最小字段

```json
{
  "session_id": "",
  "project_id": "",
  "agent": "workbuddy",
  "status": "active",
  "conversation_id": null,
  "inbox_dir": "",
  "created_at": "",
  "updated_at": "",
  "last_used_at": null,
  "last_heartbeat_at": null,
  "meta": {}
}
```

## 状态建议

- `active`
- `idle`
- `stale`
- `closed`

## 职责边界

### Bridge

- 管 `session_id`
- 管 `project_id -> session_id` 绑定
- 保存 session 基本元数据

### watcher

- 选择要复用的 session
- 必要时创建新的 session 元数据
- 更新 `last_used_at` 和 `last_heartbeat_at`

### WorkBuddy

- 在对应项目/对话上下文中执行
- 可内部维护 conversation 细节
- 不要求把内部状态完整暴露给 Bridge

## 待实现点

1. 新增 `sessions.json`
2. 新增 session 查询与创建逻辑
3. `create_task` 支持显式或默认绑定 `session_id`
4. watcher payload 中补入 `session_id`
