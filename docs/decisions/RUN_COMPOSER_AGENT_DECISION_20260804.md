# Run Composer Agent 决策原则（2026-08-04）

## 冻结决定

Run Composer 面向用户只保留一个执行选择：**由哪个本地 Agent 接单**。

以下字段不再作为常驻用户配置项：

- 工作方式：analyze / create / revise；
- 结果去向：reply / new artifact / collection / draft revision；
- 编辑对象与 Base Revision。

它们继续作为 Canonical Runtime 合同存在，但由接单 Agent 根据用户提示、选中节点、ActiveContext、Artifact/Revision 状态和 LCOS Skill 规则形成明确的执行提案，再调用 Local Core。

## 默认判断规则

1. 用户要求总结、判断、比较且不要求产生文件：`analyze + reply_only`。
2. 用户要求基于参考生成新的独立内容：`create + create_artifact/create_collection`。
3. 用户要求修改、优化、续写选中的受管内容：`revise + draft_revision_per_target`，以选中节点的明确 Revision 为 Base。
4. 单个受管节点被选中且语义为修改时，该节点自动成为 Target；其余选中节点自动成为 Context。
5. 多个可能 Target、目标不受管、Base Revision 冲突、覆盖意图或输出语义不明确时，Agent 必须提出一次简短澄清，不得猜测后直接写入。
6. AI 结果始终先进入 Draft / Pending Return，不得自动覆盖 Current。

## UI 原则

- 默认 Composer 只显示上下文节点、自然语言输入、Agent 选择和发送。
- Agent 推断出的执行计划可在发送后以一行自然语言摘要展示，例如：
  `将由 Codex 修改「脚本 V1」，生成一个待确认的新版本；另外 2 项仅作参考。`
- 高级合同字段只允许放入诊断/开发视图，不进入普通用户主流程。
- 用户可通过自然语言纠正判断，例如“不要修改原稿，只总结”。

## Skill / Core 分工

- Skill 负责意图解析、Target/Context 归类、结果策略选择与必要澄清。
- Local Core 继续严格验证 Canonical Contract、Revision 所属关系、状态与安全边界。
- Agent 不能绕过 Core 校验；UI 简化不等于后端合同或生命周期被删除。

## 后续实施范围

本文件只记录已批准方向。本轮不修改 Composer UI、Run Proposal、Skill 或 Runtime 行为；实施前需给出交互前后流程和影响文件。
