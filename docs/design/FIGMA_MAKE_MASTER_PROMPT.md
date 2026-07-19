# Figma Make Master Prompt

将下面整段作为 Figma Make 的首轮提示词；建议先只生成“默认 Canvas + 核心组件”，通过后再按补充 Prompt 逐轮扩展。

## 首轮提示词

```text
请为桌面端产品 Local Creative OS 创建一个 1440×900 的高保真、可点击 React 风格原型。

产品不是内容编辑器，而是个人创意项目的操作与上下文层：用户在一张持续存在的 Project Canvas 上看资料、写判断、创建 Command、检查 Context、派发 Run、追踪状态、接收 AI 修改文件并确认版本。

必须遵守：
1. 一个 Project 只有一张持续 Canvas。
2. Workspace 是同一 Canvas 的 Semantic Viewport；点击 Workspace 通过相机移动聚焦节点簇，不切页面、不换路由。
3. 默认常驻只有顶部 Project Tabs、左侧悬浮 Workspace Dock、Canvas、左下 Mini-map。Inspector 默认关闭并以右侧 Overlay 打开。
4. Canvas 默认显示 6 个主节点和 2 个折叠 Process，保持安静和大面积留白。
5. 节点必须一眼区分 Source、Working、Generated Draft、Context、Run、Decision，不能只靠颜色。
6. 单击节点打开贴近节点的屏幕坐标状态 Overlay；双击打开右侧一度 Relations Inspector。
7. AI 文件确认前始终显示 Draft / 待确认，不能成为 Current。
8. Target 与 Context 必须分开。Artifact Return 按 Target → Working → Run → Pending Return Zone 落位。
9. 所有内容为 Prototype Data，不暗示真实后端或 Runtime 已接通。

视觉系统：Porcelain Canvas + restrained Liquid Chrome。底层 #ECEDEA，Canvas #F5F5F2，主文字 #192837，强调 #7342E2。节点为暖瓷白、冷灰细边、顶部内高光和柔和扩散阴影；Liquid Chrome 只用于 Project +、Workspace 新增、Run 主按钮和主要确认。虹彩只做小型徽章与激活高光，不做大面积彩虹背景。整体像精密创意设备，不像 SaaS Dashboard，也不要赛博朋克。

默认场景为 PortaSplit 项目的 Understand Workspace：
- Source：客户反馈.md、品牌 Brief.pptx、参考构图.jpg，位于左侧；
- Working：当前提案.pptx，位于中间；
- Generated：当前提案_v7_AI.pptx，位于右侧，显示 Draft · 待确认；
- Decision：关键决策 Checkpoint；
- Process：一个折叠 completed Run、一个 running Run，位于下方。

顶部打开两个项目标签：PortaSplit（当前）和 Summer Launch（有一个待处理点），另有 Liquid Chrome +。
Workspace Dock 包含 Understand、Explore、Build、Decide，当前 Understand；Dock 是悬浮控制器，不是传统侧栏。
Mini-map 只显示区域、视口、选中点和一次性 Run 提示，不显示文件名。

请建立可复用组件和 variants：ProjectTabBar、WorkspaceDock、ArtifactNode、ProcessNode、DecisionNode、ContextNode、NodeStatusOverlay、SelectionToolbar、CommandNode、InspectorShell、SemanticEdge、MiniMapStepper、PendingReturnZone、Toast。

请先输出默认 Canvas 页面和组件 variants，不要生成登录、后台管理、聊天侧栏、文件管理器、团队、计费、插件市场或完整编辑器。
```

## 第二轮：Overlay 与 Inspector

```text
基于已确认的默认 Canvas 扩展两个可点击状态，不重做视觉系统：

1. 单击“当前提案.pptx”后立即选中，180ms 后在节点下方打开约 300px 宽的 NodeStatusOverlay。显示来源、Current、最近修改、父版本、2 条备注、5 个一度关系，以及“预览”“在 PowerPoint 中打开”。Overlay 通过屏幕坐标浮层呈现，不改变节点位置和连线。

2. 双击同一节点时取消单击 Overlay，右侧以 400px Overlay 打开单实例 Inspector。先显示 Relations，按来源、引用、版本、相关 Run 分组；点击“品牌 Brief.pptx”后 Push Preview，顶部保留 Back / 文件名 / Close。Preview 首屏 65% 以上显示 PPT 第 5 页，下方允许写当前页备注。Back 返回 Relations，Esc 逐级退出。
```

## 第三轮：Command 与 Context

```text
扩展 Build Workspace 交互。点击 Build 时不要切页，让 Canvas 相机移动到同一 Project Graph 的另一节点簇。

用户多选“当前提案.pptx、客户反馈.md、参考构图.jpg”，按 C 后在鼠标附近创建 Command Node。默认只显示一句指令、Target、Context 数量、Executor、Output 和 Run：
“把第 5 页的产品利益点改得更直接，保留品牌蓝，不改封面”。
Target 为当前提案.pptx；Context 为 3 个对象、2 条关键决策、1 个 Skill；Executor 为 Codex；Output 为保存为新版本。

打开 Context Lens 时在 Inspector 显示目标、3 个可排除引用、Locked Elements、2 条关键决策、相关对话摘要、PPT Message Clarity Skill 和折叠的 Snapshot 技术信息。取消参考图后数量从 3 变 2。Target 与 Context 视觉上必须分离。Cmd/Ctrl+Enter 只在 Command 编辑器内执行 Run。
```

## 第四轮：Run、Return 与 Checkpoint

```text
扩展同一 Command 的 Run 状态 variants：queued、running、waiting_input、review、completed、failed、cancelled。

running 只允许一条低强度流动银线。waiting_input 使用暖橙而不是错误红，问题为：“第 5 页产品数字沿用旧版 30%，还是使用客户反馈中的 35%？”提供“使用 35%”“保留 30%”“取消 Run”。选择 35% 后继续同一 Conversation 并进入 review。

review 显示 Changed Files：1 modified、0 deleted，并返回“当前提案_v7_AI.pptx”。结果必须是 Generated Draft / 待确认，不自动成为 Current。提供 Compare、Accept as Current、Retry、保留为独立 Draft。

Accept 后创建 Current Revision，保留 AI 来源与 Run 追溯；显示轻量 Banner：“已形成稳定修改集 · 创建 Checkpoint / 稍后”。创建 Checkpoint 后旧 Run 折叠进入 Activity。不要弹大型成功框。
```

## 第五轮：响应式与错误状态

```text
在不改变桌面信息架构的情况下补充 1366×768：Workspace Dock 默认收起，Inspector 继续覆盖 Canvas 而不是挤压，默认主节点降为 5–6 个。

补充以下组件状态但不新增页面：Artifact Missing / Stale / Sync Error；Run failed / cancelled；Inspector loading / no permission；Command no executor；Pending Return 未知 Target；prefers-reduced-motion。错误先写影响和下一步，再折叠技术详情。
```

