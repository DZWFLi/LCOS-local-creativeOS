# Dispatch Protocol V3

## 目标

规范 Codex 向 WorkBuddy 派发任务，以及 WorkBuddy 回传结果时的字段、正文模板和边界要求。

## 适用范围

适用于：

- `create_task(...)` 的入参组织
- `instruction` 的正文结构
- `input_files` / `expected_outputs` / `acceptance_criteria` 的传递方式
- `submit_result(...)` 的回传格式

补充：

- 日常短文本转发、同步、催办、回传的文本规范见
  `communication-protocol.md`

## 派单原则

1. 结构化字段优先，正文说明辅助
2. 文件路径以结构化数组为准，不以正文里手写路径为真源
3. WorkBuddy 回传的是“执行完成”，不是“最终验收通过”
4. `project_id` 必填
5. V3 中 `session_id` 应尽量显式提供；没有时由 Bridge / watcher 补齐

## create_task 最小字段

```json
{
  "project_id": "",
  "session_id": "",
  "assignee": "workbuddy",
  "executor": "workbuddy",
  "task_type": "",
  "capability": "",
  "report_mode": "short",
  "instruction": "",
  "input_files": [],
  "expected_outputs": [],
  "acceptance_criteria": [],
  "context": {},
  "priority": "normal",
  "timeout_seconds": null
}
```

## instruction 正文模板

建议统一使用以下段落顺序：

```text
任务标题：

项目背景：

任务目标：

输入材料：

执行边界：

输出要求：

回传要求：
```

## input_files 规则

1. 必须使用绝对路径或稳定 URL
2. 必须作为结构化数组单独传递
3. 正文中的路径仅作解释，不作为机器判断依据
4. 如果正文和 `input_files` 不一致，以 `input_files` 为准

## expected_outputs 规则

建议使用受控枚举，不直接写任意自然语言。

建议值：

- `markdown`
- `document`
- `presentation`
- `spreadsheet`
- `code`
- `image`
- `video`
- `report`
- `log`

## acceptance_criteria 规则

建议显式传递，而不是只埋在正文里。

示例：

```json
[
  "生成一个 Markdown 文件",
  "必须包含 4 个协议章节",
  "不得修改现有 bridge 代码",
  "artifacts 必须回传绝对路径"
]
```

## submit_result 最小回传结构

V3.1 建议从“结果摘要 + artifacts”升级为按 `report_mode` 分层：

### `full`

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

```json
{
  "task_id": "",
  "status": "review",
  "changed_files": []
}
```

说明：

- 代码任务默认优先 `short` 或 `silent`
- 交付型任务默认优先 `full`
- 长报告只在阶段节点生成，不要求每轮都产出
- `silent` 模式允许没有 `short_summary`
- 但必须至少回传：
  - `status`
  - `changed_files` 或 `artifacts` 之一

## changed_files 规则

代码或文件变更类任务建议显式回传：

```json
[
  {
    "path": "",
    "action": "modified"
  }
]
```

不要把代码变更列表混进 artifact。

V3.1 冻结：

- `changed_files.path` 强制使用绝对路径

## Codex 验收建议

代码类任务默认顺序：

1. `status`
2. `changed_files`
3. 文件内容 / diff
4. 必要时再看 `short_summary`
5. 阶段节点再看 `milestone_report_path`

交付类任务默认顺序：

1. `status`
2. `artifacts`
3. `result_summary`
4. 必要时再看里程碑总结

## artifacts 回传规则

1. `artifact` 表示交付物
2. `changed_files` 表示执行变化
3. 两者语义分离
4. 在兼容期内，代码任务可同时给出：
   - `changed_files`
   - `artifacts`（如同时产出说明文）

## 路径与转义要求

1. Windows 路径必须避免在普通字符串里被错误转义
2. 生成 `instruction` 时，正文中的路径建议来自同一个结构化源
3. 如果使用脚本构造派单，优先使用 JSON 序列化，不手写转义
4. `changed_files` 中的路径也应尽量给绝对路径

## 不建议过早做的事

1. 在派单协议里塞过多业务专属字段
2. 用自然语言正文代替结构化字段
3. 让 WorkBuddy 直接宣告最终完成
4. 第一版就强依赖复杂富文本回传
5. 所有代码任务都默认产出长说明文
