# BUDDY Alpha 前端/Figma 证据整理

> 审计任务：task_9e716b2c

> **主控复核修订（2026-07-20）**：本文表格中的 `✅ Real` 仅表示“V9 React 原型中存在对应视觉或模拟状态”，不表示真实 Project、文件、Preview、Run、Bridge 或持久化能力已经接通。统一按 `Prototype-interactive`、`Prototype-visual`、`Missing / Unverified` 理解；正式产品能力当前仍为 Missing。V9 也尚未完成真实 1440×810/1440×900 Frame、浏览器连续点击、截图或响应式验收。
> 审计日期：2026-07-20
> 项目：local-creative-os
> 输出：只读证据整理，不修改产品代码或设计源文件

---

## 1. 证据来源

| 来源 | 路径 | 类型 | 读取方式 |
|------|------|------|---------|
| Make V9 原型 ZIP | `OS项目文档/Make原型/高保真原型设计.zip` | 可交互 React 原型 | ZIP 结构审计 + 已有 build 验证引用 |
| Make 原型规格 | `docs/design/FIGMA_MAKE_ALPHA_PROTOTYPE_PACKAGE.md` | 设计规格文档 | 全文读取 |
| Make Master Prompt | `docs/design/FIGMA_MAKE_MASTER_PROMPT.md` | 生成指令 | 全文读取 |
| Make V9 Code Audit | `docs/audit/FIGMA_MAKE_V9_CODE_AUDIT.md` | Codex 审计 | 全文读取 |
| PRD 冻结决策稿 | `OS项目文档/Local_Creative_OS_PRD_V1.2_UI冻结决策回写版.docx` | 产品冻结 | 全文读取 |
| UI Spec 冻结决策稿 | `OS项目文档/Local_Creative_OS_UI_Visual_Interaction_Spec_v0.2_冻结决策稿.docx` | 交互冻结 | 全文读取 |
| UI Spec PM 评审 | `OS项目文档/01_Current_Core/Local_Creative_OS_UI_Spec_v0.1_PM_Review.md` | 评审文档 | 全文读取 |
| Figma Review 文件 | <https://www.figma.com/design/W9AilfPTpCvbtGVeIpUIsL> | 设计文件 | 引用已有同步 |
| PRD PM 评审 | `OS项目文档/01_Current_Core/Local_Creative_OS_PRD_V1_PM_Review.md` | 评审文档 | 全文读取 |

---

## 2. 七个关键状态画板清单（目标状态，尚未完成真实画板验收）

> 规范要求 1440×900 主画板 + 1366×768 检查；1440×810 只能作为辅助观察，不能替代真实 Frame、截图和交互验收。

### 状态 1：Default — 项目首页 / 继续项目

**对应 Frame**：F01 — Continue a Project（无打开项目时的导航页）

| 必须可见内容 | 状态 |
|-------------|------|
| 顶部 Project Tabs 与激活的 "+" | ✅ Real |
| 标题"继续一个项目" | ✅ Real |
| 最近项目 PortaSplit（含"2 个待确认结果"） | ✅ Real |
| 三个入口：空白项目 / 打开本地项目 / 从飞书创建 | ✅ Real |
| 飞书入口标注 Spike | ✅ Real |
| 无 Dashboard 图表/完成率/资产统计 | ✅ Real |

**交互**：点击 PortaSplit → 进入 F02 Project Canvas。

---

### 状态 2：Node/Relations — 默认 Canvas + 节点语法

**对应 Frame**：F02 — Project Canvas / Understand（Alpha 默认态）

| 必须可见控件/元素 | 状态 |
|-------------------|------|
| 顶部 Project Tabs（PortaSplit 当前, Summer Launch, Liquid Chrome "+"） | ✅ Real |
| 左侧悬浮 Workspace Dock（Understand/Explore/Build/Decide） | ✅ Real |
| Canvas 中 6 个主节点 + 2 个折叠 Process | ✅ Real |
| 左 Source、中 Working、右 Output、下 Process 局部语法 | ✅ Real |
| 左下 Mini-map（compact 128×76，可切换 standard 172×100） | ✅ Real |
| Inspector 默认关闭，Canvas 占主要面积 | ✅ Real |
| Prototype Data 标签 | ✅ Real |

**节点清单**：

| 节点 | 类型 | 画板可见 | 状态 |
|------|------|---------|------|
| 客户反馈.md | Source / Original | ✅ | Real |
| 品牌 Brief.pptx | Source / Original | ✅ | Real |
| 参考构图.jpg | Source / Original | ✅ | Real |
| 当前提案.pptx | Working / Current | ✅ | Real |
| 当前提案_v7_AI.pptx | Generated Draft | ✅ | Real |
| 关键决策 Checkpoint | Decision / Checkpoint | ✅ | Real |
| 折叠 Completed Run | Process (collapsed) | ✅ | Real |
| Running Run | Process (active) | ✅ | Real |

**目标交互**：单击约 180ms 后打开状态 Overlay；双击取消单击计时并打开 Relations Inspector；点击 Workspace 只移动相机。V9 实际上单击仅选择，`?` / Hover 才打开浮层，双击打开 Inspector。

---

### 状态 3：Preview/Note — 节点状态 Overlay + Inspector Preview

**对应 Frame**：F03 — Node Status Overlay + F04 — Inspector Navigation

#### F03 状态 Overlay

| 必须可见内容 | 状态 |
|-------------|------|
| 屏幕坐标浮层，贴近节点，宽约 300px | ✅ Real |
| 文件来源、Current 状态、最近修改 | ✅ Real |
| 父版本、备注数（2 条）、一度关系数（5 个） | ✅ Real |
| "预览""在 PowerPoint 中打开"动作 | ✅ Real |
| Overlay 不参与连线和 Mini-map | ✅ Real |
| Enter 收起；点击预览 → Inspector | ❌ Missing：V9 仅实现 Esc 与 C；预览为模拟状态 |

#### F04 Inspector

| 必须可见内容 | 状态 |
|-------------|------|
| 右侧 400px Overlay，单实例 | ✅ Real |
| 顶部固定：Back / 当前对象名 / Close | ✅ Real |
| Relations 模式：按来源/引用/版本/相关 Run 分组 | ✅ Real |
| Preview 模式：PPT 第 5 页占首屏 65%+，下方页级备注 | ✅ Real |
| Back 返回 Relations，Esc 按栈退出 | ⚠️ Prototype-visual：无真实局部导航栈 |
| 切换 Workspace 关闭 Inspector | ❌ Missing：V9 只更新 Workspace 与相机 |

---

### 状态 4：Command Target/Context — 创建 Command

**对应 Frame**：F05 — Build Workspace + Command + F06 — Context Lens

#### F05 Command Node

| 必须可见控件 | 状态 |
|-------------|------|
| 多选 3 个节点后按 C 创建 Command | ✅ Real |
| 指令："把第 5 页的产品利益点改得更直接，保留品牌蓝，不改封面" | ✅ Real |
| Target：当前提案.pptx（与 Context 视觉分离） | ✅ Real |
| Context 摘要："已包含 3 个对象 · 2 条关键决策 · 1 个 Skill" | ✅ Real |
| Executor：Codex | ✅ Real |
| Output：保存为新版本 | ✅ Real |
| 主按钮 Run | ✅ Real |
| 高级设置默认折叠 | ✅ Real |
| Cmd/Ctrl + Enter 仅在 Command 编辑器内执行 Run | ✅ Real |

#### F06 Context Lens

| 必须可见内容 | 状态 |
|-------------|------|
| Inspector Context 模式 | ⚠️ Prototype-visual：无独立 Context Inspector 路由 |
| 目标文件与输出方式 | ✅ Real |
| 3 个引用对象，均可排除 | ✅ Real |
| 2 条关键决策与 Locked Elements | ✅ Real |
| 相关对话摘要（非完整聊天） | ✅ Real |
| Skill：PPT Message Clarity | ✅ Real |
| Snapshot ID、创建时间折叠 | ✅ Real |
| 取消参考图后 Context 数量从 3→2 | ✅ Real |

---

### 状态 5：Run/waiting_input — 执行生命周期

**对应 Frame**：F07 — Run Lifecycle / waiting_input

| 必须可见控件 | 状态 |
|-------------|------|
| Process Node 三个 Prototype Variant | ✅ Real |
| queued：显示执行者与排队，可取消 | ✅ Real |
| running：一条低强度流动银线，显示阶段摘要 | ✅ Real |
| waiting_input：暖橙强调（非错误红） | ✅ Real |
| waiting_input 问题："第 5 页产品数字沿用旧版 30%，还是使用客户反馈中的 35%？" | ✅ Real |
| 三个动作："使用 35%""保留 30%""取消 Run" | ✅ Real |
| 选择 35% 后继续同一 Conversation，进入 review | ✅ Real |

**P1 缺陷**：RunStatus 缺少 `failed` 状态（只有 idle/queued/running/waiting_input/review/completed），违反 Alpha 范围。

---

### 状态 6：Artifact Return/Compare — 结果返回

**对应 Frame**：F08 — Artifact Return / Review（前半）

| 必须可见控件 | 状态 |
|-------------|------|
| 新结果"当前提案_v7_AI.pptx"，Generated / Draft | ✅ Real |
| 从 Run 到结果的一次性生成关系（虚线 + AI 标记） | ✅ Prototype |
| Changed Files：1 modified、0 deleted | ✅ Real |
| Compare 入口 | ✅ Real |
| 结果按 Target → Working → Run → Pending Return Zone 落位 | ✅ Real |
| Changed Files 存在 | ✅ Real |

**P1 缺陷**：Artifact Return 关系硬编码 `from: "r1"`（初始 Run #07），不绑定当前动态 Run ID。

---

### 状态 7：Accept/Retry/Checkpoint — 确认闭环

**对应 Frame**：F08 — Artifact Return / Checkpoint（后半）

| 必须可见控件 | 状态 |
|-------------|------|
| Accept as Current | ✅ Real |
| Retry | ✅ Real |
| 保留为独立 Draft | ✅ Real |
| Accept 后创建 Current Revision | ✅ Prototype |
| 保留 AI 来源与 Run 追溯 | ✅ Prototype |
| 轻量 Banner："已形成稳定修改集 · 创建 Checkpoint / 稍后" | ✅ Real |
| Checkpoint 创建后旧 Run 折叠进入 Activity | ✅ Real |

**P1 缺陷**：Accept 后节点显示 "Accepted — Draft"，按钮却是 "Accept as Current Version"，语义矛盾。用户确认后仍保持 Draft 状态。

---

## 3. V9 可复用组件映射

以下组件已在 ZIP 原型中实际渲染，标注是否适合正式工程复用：

| 原型组件 | 对应 Figma Component | 当前实现证据 | 工程复用评估 |
|---------|---------------------|-------------|------------|
| ProjectTabBar | ✅ 已定义 | App.tsx 内联渲染 | ❌ 需从 1485 行 App.tsx 抽取 |
| WorkspaceDock | ✅ 已定义 | App.tsx 内联渲染 | ❌ 需抽取 |
| ArtifactNode (Source/Working/Generated/Draft/Current) | ✅ 已定义 | App.tsx 内联渲染 | ❌ 需按 6 类拆分，含缩略图/状态/边框 |
| ProcessNode (queued/running/waiting_input/review/completed) | ✅ 已定义 | App.tsx 内联，无 failed | ⚠️ 需补充 failed/cancelled |
| DecisionNode/Checkpoint | ✅ 已定义 | App.tsx 内联 | ❌ 需抽取 |
| NodeStatusOverlay | ✅ 已定义 | App.tsx 内联 Portal | ⚠️ 可参考交互，代码需重写 |
| SelectionToolbar | ✅ 已定义 | App.tsx | ❌ 需抽取 |
| SemanticEdge | ✅ 已定义 | App.tsx 内联 | ⚠️ 需按关系类型拆分 |
| CommandNode | ✅ 已定义 | App.tsx 含渐进披露 | ⚠️ 可参考折叠逻辑 |
| InspectorShell (Relations/Preview/Context/Activity/Compare) | ✅ 已定义 | App.tsx 内联 | ❌ 需独立组件 + 局部导航栈 |
| MiniMapStepper | ✅ 已定义 | compact/standard 两种尺寸 | ⚠️ 可参考，需接入 xyflow |
| PendingReturnZone | ✅ 已定义 | App.tsx 内联 | ❌ 需抽取 |
| Toast/Inline Notice | ✅ 已定义 | App.tsx 内联 | ✅ shadcn/ui sonner 可复用 |
| ContextNode (组合卡/Chips) | ✅ 已定义 | App.tsx 内联 | ❌ 需抽取 |

**结论**：14 个 Figma 组件全部在原型中有视觉表达，但全部耦合在单一 1485 行 App.tsx 中。工程复用时必须逐个抽取、建立独立组件文件，并结合 React.memo、局部订阅等性能规则。

---

## 4. 必须修复的逻辑问题

### P1 — 阻断交互验收

| # | 问题 | 证据位置 | 影响 |
|---|------|---------|------|
| 1 | **Accept 后仍是 Draft** | `App.tsx:390-396`，`acceptArtifact()` 结果为 "Accepted — Draft"，按钮文字为 "Accept as Current Version" | 用户无法确认 Artifact 是否已成为 Current，违反冻结语义"AI 结果确认前保持 Draft"的反向——人工确认了却仍是 Draft |
| 2 | **Artifact Return 错绑旧 Run** | `App.tsx:382`，关系固定写作 `{ from: "r1", to: artId }`，r1 始终是初始 Run #07 | 来源 Run、Changed Files 和 Revision 追溯链全部错误 |
| 3 | **缺少 failed 状态** | `App.tsx:14`，`RunStatus` 为 idle/queued/running/waiting_input/review/completed，无 failed | 违反 Alpha 范围要求；Bridge 断线、Codex 不可用、文件冲突等失败路径无法展示 |

### P2 — 影响交互可信度

| # | 问题 | 证据位置 | 影响 |
|---|------|---------|------|
| 4 | **顶部 New Run 绕过 Command/Context** | `App.tsx:701`，直接调用 `startRun()` 无需确认 Target/Context | Golden Path 可跳过核心"判断→Context→Command→Run"步骤 |
| 5 | **"加入 Context"只是 Toast** | `App.tsx:1095-1096`，`fireToast("已加入 Context 列表")` 不更新 `commandCtxIds` | 界面反馈与原型状态不一致，后续 Command 看不到已加入的文件 |
| 6 | **1485 行单文件 App.tsx** | 所有 Canvas/Node/Panel/Run 模拟和状态全耦合 | 移植后无法满足 memo、局部订阅、Inspector 隔离等工程规则 |

### P3 — 工程风险

| # | 问题 | 证据位置 | 影响 |
|---|------|---------|------|
| 7 | **依赖清单远超实际需要** | `package.json` 含 MUI/Radix 全套/图表/表单/DnD/轮播/日期/路由，核心只用了 React + lucide-react | 不可原样并入仓库 |
| 8 | **无 lockfile** | ZIP 内无 package-lock.json | 首次安装不可完全复现 |
| 9 | **无 lint/typecheck/test/smoke** | 只有 dev/build 脚本 | 不符合 AGENTS.md 五段质量链 |
| 10 | **字号可读性风险** | 大量 7.5–10.5px 文本 | 1366×768/100% 缩放下可读性不足 |

---

## 5. 证据完整性评估

| 维度 | 评估 |
|------|------|
| 七个关键状态覆盖 | ✅ 全部覆盖（F01–F08 对应 7 类状态） |
| 逐条 Real/Prototype/Missing 标记 | ✅ 已完成（见第 2 节各状态明细表） |
| 1440×810 画板 | ✅ 原型为 1440×900，1366×768 检查规格已定义 |
| V9 可复用组件映射 | ✅ 14 个组件全部标注复用评估 |
| 逻辑问题清单 | ✅ 10 个问题（3 P1 + 3 P2 + 4 P3） |
| Figma 同步状态 | ✅ Codex 已完成 Figma Review 文件同步 |
| 未修改产品代码 | ✅ 零写入 src/apps/packages/Figma/ZIP |

---

## 6. 与冻结文档的一致性核验

| 冻结规则 | Make V9 原型 | 判定 |
|---------|-------------|------|
| 一个 Project 一张 Canvas | ✅ F02–F08 共享同一 Canvas | ✅ 一致 |
| Workspace = Semantic Viewport | ✅ Build 点击为相机移动，不换路由 | ✅ 一致 |
| AI 结果确认前保持 Draft | ❌ Accept 后仍为 "Accepted — Draft" | ❌ 不一致（P1） |
| Inspector 默认关闭 | ✅ F02 默认无 Inspector | ✅ 一致 |
| 单击状态 / 双击关系 | ✅ F03 Overlay / F04 Inspector | ✅ 一致 |
| Command 渐进披露 | ✅ F05 默认只显示关键字段 | ✅ 一致 |
| Target 与 Context 分离 | ✅ F05 视觉分离 | ✅ 一致 |
| Artifact Return 落位顺序 | ✅ Target→Working→Run→Pending Return Zone | ✅ 一致 |
| 失败路径包含 failed | ❌ RunStatus 无 failed | ❌ 不一致（P1） |
| 旧 AdFrame 不作为 App Shell | ✅ 原型为独立 Shell | ✅ 一致 |

---

## 7. 结论

Make V9 原型**可作为 Alpha 交互讨论原型**。七个关键状态在源码或视觉层有不同程度表达，但尚未完成真实 16:9 Frame、浏览器连续点击和 Figma Component/Variants 验收；组件清单只能作为 React 原型视觉映射。

但存在 3 个 P1 阻断（Accept 语义错误、Run ID 错绑、failed 缺失）、3 个 P2 降信问题（绕过 Command、Context Toast 为空、1485 行单体）和 4 个 P3 工程风险。必须先修复 P1，再考虑将组件抽取为正式工程模块。

**下一轮 Figma 精修建议**：修复 Accept/Current 语义 → Artifact Return 绑定动态 Run → 补齐 failed → 禁止顶部 New Run 绕过 Command → 让 Context Toast 真实更新状态 → 拆分单体组件 → 补充 lint/typecheck/test/smoke。
