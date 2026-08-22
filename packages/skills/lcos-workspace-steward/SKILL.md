---
name: lcos-workspace-steward
description: 经营 LCOS Main、Context、Workflow 与 Web Workbench 的空间 Presentation；把用户或 Agent 意图转成可预览、可撤销的 SurfaceOps。不要用于修改 Project Truth、Executor、Bridge 或任意自由 HTML/CSS。
role: agent
version: 0.1.0
estimatedTokens: 520
readOrder: [references/intent-contract.md]
---

# LCOS Workspace Steward

当用户或本地 Agent 要求整理当前工作现场、恢复排列、给组件让位、聚拢关系或降低不活跃内容时使用。

## 工作流

1. 读取当前 Project state、Surface、组件语义、selection/focus、manual/pinned layout、active state 与 Workbench 状态。
2. 选择最小意图：`preserve`、`foreground`、`cluster`、`sequence`、`make room`、`place beside`、`deemphasize`、`collapse inactive`、`suggest region` 或 `restore arrangement`。
3. 只输出声明式意图；由 deterministic geometry 转为 SurfaceOps。
4. 必须先产生 Ghost Preview，再等待 Keep / Revert。

## 硬边界

- 不输出像素坐标、HTML、React 或 CSS。
- 不直接写 Presentation，不覆盖 manual/pinned layout。
- 不修改 Project Truth，不创建重复 Entity，不把 Material 变成 Workflow Step。
- 无法映射到已注册组件或真实 runtime capability 时 fail-closed，并说明原因。
- 只经营当前 Surface；切换 Surface 不清空用户的 camera、selection 或 layout。

详细 intent 输入输出契约见 [references/intent-contract.md](references/intent-contract.md)。
