# Result Protocol V3.1

## LCOS ResultEnvelopeV0

Slice B freezes, but does not yet ingest, this minimal LCOS result contract:

```json
{
  "contractVersion": "bridge-result-v0",
  "taskId": "task_xxx",
  "lcosRunId": "run_xxx",
  "providerStatus": "review",
  "shortSummary": "Draft created.",
  "resultSummary": "Optional provider summary.",
  "changedFiles": [
    {
      "path": "C:/approved-runtime/staging/script-draft.md",
      "action": "created"
    }
  ]
}
```

MVP accepts only `action=created`. The Bridge records Provider evidence; the
future Local Core Result Ingestion service remains the final path, hash,
ArtifactReturn and Revision authority.

## 目标

定义任务执行完成后的结果回传结构，避免所有任务都统一走长回传。

V3.1 引入：

- `report_mode`
- `changed_files`
- `short_summary`
- `milestone_report_path`

核心原则：

1. Task 决定回传粒度，不由 Agent 自由发挥
2. `artifact` 代表交付物
3. `changed_files` 代表执行变化
4. 代码类任务优先看变更文件和状态，而不是长说明

## Report Mode

建议三档：

### `full`

适合：

- `research`
- `document`
- `presentation`
- 创意方案
- 阶段总结

返回重点：

```json
{
  "task_id": "",
  "status": "review",
  "result_summary": "",
  "artifacts": [],
  "milestone_report_path": ""
}
```

### `short`

默认推荐。

适合：

- 普通开发任务
- 小修改
- 文件整理
- 中低频执行任务

返回重点：

```json
{
  "task_id": "",
  "status": "review",
  "short_summary": "",
  "changed_files": [],
  "artifacts": []
}
```

### `silent`

适合：

- 高频调试
- 连续修 bug
- 小范围重构

返回重点：

```json
{
  "task_id": "",
  "status": "review",
  "changed_files": []
}
```

说明：

- `silent` 不等于没有回传
- 只是尽量不生成长自然语言总结
- Codex 主动读文件和 diff 验收
- V3.1 冻结：`silent` 模式允许无 `short_summary`，但必须至少包含 `status + changed_files/artifacts` 之一

## changed_files

`changed_files` 应独立于 `artifacts`。

原因：

1. `artifact` 是交付物
2. `changed_files` 是执行变化
3. 代码修改不是“交付文档”，不应污染 artifact 语义

建议结构：

```json
[
  {
    "path": "E:\\Buddy项目\\ai-bridge\\bridge_server.py",
    "action": "modified"
  }
]
```

`action` 建议枚举：

- `created`
- `modified`
- `deleted`
- `moved`

V3.1 冻结：

- `changed_files.path` 强制使用绝对路径

## artifact 与 changed_files 分离示例

```json
{
  "task_id": "task_xxx",
  "status": "review",
  "short_summary": "完成 session 层改造",
  "changed_files": [
    {
      "path": "E:\\Buddy项目\\ai-bridge\\bridge_server.py",
      "action": "modified"
    }
  ],
  "artifacts": [
    {
      "type": "document",
      "path": "E:\\Buddy项目\\codex协作测试\\阶段总结.md"
    }
  ],
  "milestone_report_path": null
}
```

## milestone_report_path

不建议每次执行都生成长报告。

因此 V3.1 用：

- `milestone_report_path`

而不是：

- `detailed_report`

适用场景：

- 阶段节点
- 里程碑完成
- 大范围改造收口

例如：

- `V3 Session Layer 改造总结.md`
- `Bridge 第一阶段兼容性修复总结.md`

## Codex 验收顺序

### 对代码类任务

默认顺序改为：

1. `task status`
2. `changed_files`
3. 文件内容 / diff
4. 必要时看 `short_summary`
5. 阶段节点才看 `milestone_report_path`

### 对交付类任务

默认顺序：

1. `task status`
2. `artifacts`
3. `result_summary`
4. 必要时看里程碑报告

## 不建议过早做的事

1. 所有任务统一强制生成长说明
2. 用 `artifact` 兼任代码变更列表
3. 让 Agent 自己决定回传粒度而不看 Task 配置
