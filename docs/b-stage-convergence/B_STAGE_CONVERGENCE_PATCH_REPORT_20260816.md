# LCOS B 阶段收敛补丁报告

日期：2026-08-16  
基线：`LCOS_FULLSTACK_B-CLOSED_C-EARLY_20260816`  
性质：B 阶段交互/AI/流程收敛补丁，不新增新的 B 阶段能力，不扩 C 阶段架构面。

## 1. 收敛目标

本轮只解决四类问题：

1. AI 入口过多、Prompt 到处出现；
2. Intent / Skill / 下一步等内部运行时语言外露，重新产生固定流程感；
3. Context / Workflow 已有能力挤在上下栏，缺少空间级轻入口；
4. Sidecar / 浏览器协作模式仍是桌面 GUI 的缩窄版，窄宽度下发生遮挡与争抢。

冻结产品原则：

> AI 是 LCOS 的能力，不是 LCOS 的界面。
>
> 流程是工作历史的沉淀结果，不是进入工作的方式。
>
> 主画布工作时保持安静；Context 关心什么值得记住，Workflow 关心什么值得复用。

## 2. 三大视图入口收敛

新增统一空白右键菜单 `SurfaceContextMenu`，按视图定制：

- Arrange：创建内容、导入、新建现场、空间整理等；不提供 Agent Node。
- Context：允许显式放置局部 Agent Node、查看沉淀候选等。
- Workflow：允许显式放置局部 Agent Node、查看方法沉淀候选等。

右键菜单只承接次级能力，不改变 Project Truth；Agent 结构修改继续走 Proposal / Preview / Apply。

## 3. Agent Node 化用

新增 `SurfaceAgentNode`：

- 只允许 Context / Workflow 显式召唤；
- 主画布不出现 Agent Node；
- 会话级、Presentation-only，不成为 Project Entity；
- 可在视图内拖动；
- 创建时冻结局部上下文标签；
- 提交后节点继续保留，可连续追问；
- 切换 Surface 时清理；
- 底层仍复用现有 Run / Context / Attention / Proposal 能力。

Agent Node 是局部对话锚点，不是 Workflow operator。

## 4. AI/流程收敛

### 4.1 主画布

- Selection 工具条移除常驻 Agent 按钮；
- Selection / Pin / Scene 变化继续更新 Attention，但正常刷新使用 `intentPolicy='rules_only'`，不因普通选择变化调用模型；
- 临时 Composer 只有明确召唤才出现；
- Composer 关闭不再顺手清空空间 Selection。

### 4.2 Intent / Skill

- Intent / Skill Runtime 保留；
- 协作面板不再常驻展示 Intent 下拉、Skill、Utility Provider、修改请求流程、Continuity “下一步”；
- Selection Composer 的执行方式、Provider、结果策略折叠到“高级”；
- 正常 UI 只保留自然语言输入、当前参考与发送。

### 4.3 Workflow 语言

- 删除 Workflow 常驻“交给 Agent / 让 Agent 搭建”入口；
- Workflow 仍是 Edge-first；
- “下一步关系 / 下一步说明”统一收敛为“关系 / 条件 / 依赖 / 说明”；
- 临时 Presentation Relation 与持久项目 Relation 语义保持不变。

### 4.4 僵尸路径

删除已无真实渲染路径的 `SurfaceComposerBar.tsx`，避免后续接线时固定流程 UI 重新复活。

## 5. AI 提示节奏

新增 `boundaryHintState`，时间只是提示资格窗口，不是机械定时器。

### 主画布 / Scene

- 30 分钟“有意义操作”闲置；
- 只在用户回来后允许出现一次轻提示；
- 不推荐固定下一步，可做项目状态相关的恢复/观察/轻互动。

### Context

- 20 分钟冷却；
- 只有出现新的可沉淀证据才提示；
- 候选来自项目变化、文件/网页、Agent/Chat、Artifact Return、Decision、Pin、B4 Evidence 等。

### Workflow

- 4 小时冷却；
- 必须出现重复动作/判断/Skill/Run/Conversation/ChangeSet 模式才提示；
- 只提出“是否保留为方法”，不自动生成 Workflow。

统一规则：

`cooldown satisfied + new evidence + enough confidence + user not busy` 才有资格开口。

## 6. 项目恢复

B6 Resume 继续存在，但只作为项目重新进入边界：

- 每次项目打开会话最多提示一次；
- 点击只恢复 Scene / WorkState / Attention / Context；
- 明确提示“不会自动开始任何动作”；
- 不把 Continuity Candidate 常驻成任务列表。

## 7. 文件夹导入改为 source-first

`project-root-indexer` 不再按目录层级自动把目录升级成 Collection / Workspace。

新语义：

- 真实文件进入项目根工作空间；
- 原始目录通过 `observedPath` 保留 provenance；
- 目录层级只用于初始空间分组/来源理解；
- 不自动创建 `collection` scope / folder artifact / folder view；
- 用户需要整理时主动召唤 Agent；
- Agent 阅读目录、文件内容、现有 Context 后提出 Proposal，用户接受后才形成 Collection / Context / Scene / Relation。

文件夹是来源，不是 LCOS ontology。

## 8. Sidecar / 浏览器协作模式

Sidecar 明确变成 Project Companion，而不是压缩桌面 Workspace：

- 顶栏：44px 单排；
- Workspace rail：38px 横向现场条；
- 底部能力栏：52px 单排；
- 隐藏重复 Scope axis、zoom、说明性 hint；
- 协作状态卡展开后进入底部 safe area，不再与右上 Workspace rail 抢空间；
- <=420px 进一步压缩项目元信息与按钮；
- 逻辑层禁止 Selection Composer / Global LCOS Composer；
- CSS 再做 fail-safe，避免 HMR/legacy state 让 Prompt 幽灵恢复。

Sidecar 只负责项目状态、Capture/Return、同步与待确认，不作为第二个 Chat 应用。

## 9. 底层能力保持

本轮没有删除：

- B4 WorkState / Intent Resolver / Attention / Context Composer / Skill Routing；
- B5 ChangeSet / Undo / Relation / Feedback→Revision；
- B6 Resolver / Session Binding / Resume / Attach / Return；
- R17 Project Realtime Runtime。

只改变 UI Projection、触发策略和语言。

## 10. 验证结果

静态合同：

- A4 13/13
- A5 13/13
- A6 10/10
- B1 11/11
- B3 17/17
- B3R4 10/10
- B3R5 10/10
- B3R6 16/16
- B4 19/19
- B5 14/14
- B6 16/16
- B-stage convergence 24/24

总计：**173/173 PASS**。

TypeScript/TSX syntax transpile：

- 520 个 `.ts/.tsx`（排除 `.d.ts`）
- 0 syntax errors

相对 B-C Early 基线：28 个文件级差异。

## 11. 当前环境未完成的完整工程 Gate

沙箱 `npm ci --ignore-scripts --prefer-offline` 90 秒超时，且未生成 `node_modules`。

因此本轮不能声称以下已通过：

- workspace semantic typecheck
- Vitest unit/integration
- architecture tests
- Playwright
- lint
- production build

这些必须在真实开发机完整复验。

## 12. 明天真人重点验收

### AI/流程

- 普通 Selection 不弹 AI 建议；
- 主画布没有 Agent Node / 常驻 Agent 按钮；
- Composer 只有明确召唤才出现；
- 关闭 Composer 不丢 Selection；
- Intent/Skill/“下一步”不在常规 UI 暴露；
- 项目恢复只出现一次且不自动执行。

### Context / Workflow

- 空白右键菜单符合当前视图；
- Agent Node 仅 Context/Workflow 可放；
- Agent Node 可拖、可连续追问、切视图消失；
- Context 20 分钟窗口有新证据才提示；
- Workflow 4 小时窗口有重复方法证据才提示；
- 沉淀必须用户接受，不自动改 Project Truth。

### 文件夹

- 拖入多层目录不自动制造 Collection 树；
- 文件原路径可追溯；
- 用户可通过 Agent 组织并 Preview/Apply。

### Sidecar

重点测试 360 / 390 / 420 / 480px 宽度：

- 顶栏无重叠；
- Workspace rail 不与协作卡打架；
- Bottom dock 不换成第二排；
- 不出现任何 LCOS Prompt Composer；
- Capture/Return/同步状态仍可读；
- 展开协作面板不遮死核心工作区域。

### Realtime

继续观察 R17 已知高风险：

- Save timeout
- “视图已在其他位置变化”伪冲突
- Leader 接管
- 多标签 / Tap / Companion 长时间运行

本轮没有修改 R17 实时协议，但 Sidecar/AI 请求减少应降低额外压力。

## 13. 最终冻结句

> AI 不追着操作跑，只在有足够项目证据、用户也有空间听的时候开口。

> Context 关心什么值得记住；Workflow 关心什么值得复用；主画布负责工作。

> 新增能力优先寻找空间中的轻入口，不默认增加新的常驻栏、面板或 Prompt。
