# Context Protocol V3

## 目标

定义任务执行时哪些上下文需要显式传入 Bridge / Task，哪些只保留在项目本地环境。

## 设计原则

1. Context 是 Task 的输入增强层，不是长期记忆本体
2. 只传任务执行真正需要的上下文
3. 长期积累信息交给 Memory 协议承接
4. Context 更像“指路牌”，不是“百科全书”

## 建议最小字段

```json
{
  "context_id": "",
  "project_id": "",
  "session_id": "",
  "summary": "",
  "refs": [],
  "constraints": [],
  "acceptance_criteria": [],
  "created_at": ""
}
```

## Bridge 持有

- 任务摘要
- 外部引用链接
- 明确约束
- 验收标准

## WorkBuddy 内部持有

- 执行时临时推理路径
- 内部任务拆解细节
- 子 Agent briefing

## refs 建议

`refs` 可引用：

- 文档链接
- 本地输入文件
- 项目 memory 文件
- 协议文档
- 项目目录中的关键说明文件

## 不建议过早做的事

1. 把整个项目历史都塞进 task context
2. 在 Bridge 里复制 WorkBuddy 内部执行轨迹
