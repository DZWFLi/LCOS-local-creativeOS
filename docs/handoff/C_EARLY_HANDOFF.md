# LCOS C 阶段提前完成项

本轮只做可以直接复用 B6 且不扩大架构面的能力。

## 已提前

1. Provider-neutral `ContinuityAttachBundleV1`
2. Provider-neutral `ContinuityReturnIntakeV1`
3. CLI Harness 连续性入口
4. 既有 Codex/WorkBuddy Provider Session 继续进入 Resume
5. 既有 Browser Capture 继续作为 Browser→LCOS 最小入口

## 明确未提前

- 完整 Claude/DeepSeek/Codex Harness Adapter 生命周期
- 完整 Browser Runtime / Login Profile / Tab Restore
- 浏览器自动操作
- 完整执行事件协议
- 完整 Agent/Skill/Tool permission runtime
- Project Memory Graph 后台重构

这些属于正式 C，不应为了“顺手”扩大本轮风险面。
