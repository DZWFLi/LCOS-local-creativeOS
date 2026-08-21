# LCOS GUI 重构总 Brief｜VNext.3 能力框架保留・项目语义解绑版

日期：2026-08-08  
优先级：**高于 VNext.2；与旧 Brief 冲突时以本版为准**  
用途：正式前端继续重构、Codex / 本地 Agent 实施、GUI 验收与后续 Core 边界校准

---

# 0. 这轮到底纠正什么

前几轮的问题不是 LCOS 的外层 GUI 框架错了，而是我们开始替所有项目规定内部应该怎么长：

- Context 必须是什么树；
- Workflow 必须按哪几个阶段；
- 哪类 Node 应该属于哪一层；
- History 应该描述整个项目；
- Run / Deliver 是否需要独立页面；
- Workspace 要不要带“理解 / 探索 / 构建 / 决策”等固定意图。

这些限制全部过度设计。

**外层大框架保留，内部语义解绑。**

一句话：

> **LCOS 固定能力入口和成熟交互，不固定项目的信息架构。**

本地 Agent 根据每一个项目自己的内容、协作方式、Skills 与 `AGENTS.md` 自己搭结构；GUI 负责让这些结构一眼看懂、两次点击内能交给 Agent 操作，并保持成熟 Canvas + iOS 原生感。

---

# 1. 第一性产品定义

LCOS 是：

> **给本地 Agent 和人共同使用的项目可视化平台。**

它不是内容生成平台，也不是要求用户按照预设业务流程工作的项目管理器。

LCOS 应提供两件东西：

1. 一套非常稳定、自由、成熟的项目 Canvas / View / Relation / Workspace / Collection / Run / Revision 基础能力；
2. 一套极易理解的 GUI 能力入口，让用户知道“LCOS 可以帮我整理、理解对话上下文、搭项目工作方法”，但不替用户规定具体搭法。

因此最重要的设计原则是：

```text
固定：能力入口、交互语法、技术事实
开放：项目结构、业务层级、节点意义、工作流程
```

如果一个业务概念可以由 Agent 通过：

```text
Object
Relation
View
Metadata
Layout
```

表达，就不要急着把它固化成 Core / GUI 的业务类型。

---

# 2. 外层框架继续保留

这是 LCOS 自己的产品语言，需要稳定，因为它帮助用户第一次打开就知道软件大概能做什么。

```text
┌─────────────────────────────────────────────┐
│ 顶部 Project Strip                          │
│                                             │
│ 左侧 Rail          中央成熟 Canvas           │ 右侧 Run Rail
│ 我去哪             具体怎么搭                │ 执行到哪
│                                             │
│            底部 Capability Bar              │
│          [整理] [上下文] [工作流]            │
└─────────────────────────────────────────────┘
```

## 2.1 左侧 Rail

回答：

> **我去哪？**

保留：

- Root / Scope；
- Workspace；
- Collection / child canvas；
- Agent 创建的 Saved View / Project View（后续）；
- 最近 / 重要定位入口。

视觉参考 GPT Desktop：

- 图形 / 小缩略图优先；
- 窄 Rail；
- Hover 才展开名称与摘要；
- 点击平滑定位；
- 不做永久宽 Sidebar。

左侧 Rail 不需要知道某个区域“属于 Brief 阶段还是 Production 阶段”。

## 2.2 底部 Capability Bar

回答：

> **我现在想做哪类工作？**

用户层保留三个能力入口：

```text
整理
上下文
工作流
```

关键：**它们是能力预设 / 工具重心，不是三套强制业务流程。**

进入某个能力区以后，仍然允许自由 Canvas、拖动、Selection、Relation、Collection、Workspace、Agent 等基础操作。

## 2.3 中央 Canvas

回答：

> **具体怎么搭？**

这是自由度最高的区域。

LCOS 提供积木和 Renderer，用户 / Agent 决定怎么组合。

## 2.4 右侧 Run Rail

回答：

> **这一次执行到哪？**

Run 继续使用右侧执行列表，不再建立 Run 页面。

---

# 3. 三个 Capability 的正确含义

## 3.1 整理

它只是告诉用户：

> **这里最适合整理项目空间与内容。**

默认工具可以包括：

- Free Canvas；
- Workspace；
- Collection；
- Relation；
- Auto Arrange；
- Import；
- Drop Shelf；
- Preview；
- Near-field Agent Composer。

但 LCOS 不规定：

- 项目必须分成几个区；
- 哪个区叫 Brief；
- 哪个区叫 Production；
- 文件必须按照什么层级摆。

用户与 Agent 觉得怎样对这个项目最好理解，就怎样搭。

---

## 3.2 上下文

它告诉用户：

> **这里可以把某一次与 Agent 的对话 / Context 更容易理解和找回来。**

### 关键纠偏：Context History 属于“一条导入对话”

不要把它自动扩大成整个 Project History。

真实项目可能包含：

```text
周一上午 ChatGPT
+ 周一下午 Codex
+ 周二 WorkBuddy
+ 客户 PDF
+ 本地脚本
+ 多次 Revision
```

整个项目最终怎么合并理解，应由 Agent / 用户另建 Project View，不由 Context GUI 自动规定。

### 对话历史 GUI 的目标

不是把数据库重新画出来，而是：

```text
一眼看到重要修改点
→ 快速定位
→ 需要细节时交给本地 Agent 查数据库 / Memory MD / 原始 Session
```

因此采用 GPT Desktop 式 **Change Navigation Rail**：

```text
◆
│
●
│
◇
│
◆
```

- 小点：普通章节变化；
- 中点：值得回看的变化；
- 大 / 菱形点：重要修改、方向变化、用户钉选重点；
- Hover：短标题 + 一句话变化摘要；
- 点击：平滑定位到对应消息 / 章节，并短暂高亮；
- 可直接“让 Agent 提炼”；
- 不在 GUI 展开全部 Run / Revision / Database details。

详细事实仍由：

- 原始时间线；
- 本地数据库；
- Memory MD；
- Session records；

保存。

### Tree / Outline / Graph 怎么看

它们都是 LCOS 提供的**可选工具 / Renderer**，不是 Context 的固定 Schema。

Agent 可以判断：

- 这个长对话适合 Tree + Change Rail；
- 另一个对话适合 Local Graph；
- 一个很短的 Session 根本不需要 History Rail；
- 用户也可手动切换 / 重排。

不再规定“Context 必须先 Tree，再 Graph，再 History”。

---

## 3.3 工作流

它告诉用户：

> **这里可以把这个项目的工作方法、Skill 使用和 Agent 协作方式可视化。**

它主要解决真实痛点：

```text
项目 Skill 很多
→ Agent 经常不会主动用
→ 不停往默认 Prompt / AGENTS.md 塞提醒很低效
→ LCOS 把规则可视化、复用
```

但工作流同样不能被 LCOS 写死。

LCOS 可以提供积木：

- Skill；
- Agent；
- 文件 / Context；
- Relation；
- Trigger；
- Gate / Review；
- Output；
- Run reference；
- Note / 自定义节点。

**不规定必须：**

```text
Input → Skill → Executor → Review → Output
```

这只能是模板，不能是 Core Schema。

工作流默认可以有左 → 右的 Auto Arrange，但用户始终可以自由拖动、分支、合并、混排。

### AGENTS.md

`AGENTS.md` 是重要输入，但不是唯一 UI Truth。

Agent 可以读取：

```text
AGENTS.md
+ installed Skills
+ 项目文件
+ 用户现有 LCOS View
```

然后建议 / 搭建适合当前项目的 Workflow。

运行某一步时，只编译当前需要的最小：

```text
Goal
+ Required Context
+ Skill
+ Constraints
+ Output expectation
```

而不是每次把所有 Skill 文档和整份项目规则全塞进去。

---

# 4. Run 不再属于 Bottom Capability

Workflow 与 Run 必须分开：

```text
Workflow
= 项目“应该怎么做”的长期可视结构

Run
= 某一次真的执行出来的实例
```

Run 只放右侧 Rail / Drawer：

```text
● Codex · 执行中
◐ Buddy · 等待输入
◇ Draft V5 · 待确认
✓ Search · 完成
```

支持：

- 最近 Run 列表；
- Running / Waiting / Review / Failed / Completed；
- Cancel；
- Retry；
- Waiting Input；
- Review；
- Logs；
- 定位对应 Canvas Object / Workflow graph / Context source。

**禁止重新建立 Run 主页面。**

Review / Deliver 同理，它们是对象或 Workflow 的局部状态，不需要为了 UI 对称再造一个底部页面。

---

# 5. Agent 是 LCOS 的“项目 UI 共建者”

Agent 不只是在画布里跑任务。

它应该可以直接帮助用户维护 LCOS 本身：

```text
create / rename View
move / arrange Objects
create Relation
group / Collection
create / modify Workspace
build / adjust Workflow
select Renderer
pin important conversation changes
highlight / focus
```

例如用户只需：

```text
框选五个对象
→ Agent
→ “按你对这个项目的理解重新整理一下”
```

或：

```text
打开某条对话
→ Agent
→ “把真正影响方向的几个点标出来”
```

核心验收指标：

> **从当前状态到让 Agent 操作 LCOS，本质操作不超过两次点击。**

不要出现：

```text
选类型 → 选模式 → 选目标 → 选 Skill → 选 Agent → 确认
```

这种流程。

---

# 6. Core / GUI 语义边界

Core 必须知道的是稳定技术事实，例如：

- Project；
- Object / View reference；
- Relation；
- Canvas Scope / Collection；
- Workspace；
- Session；
- Run；
- Revision；
- Agent / Skill reference；
- Layout；
- Selection；
- History / Undo；
- ContextSnapshot 等执行所需技术记录。

Core / GUI 不应仅为了产品解释方便就强制知道：

- Brief；
- Feedback；
- Decision；
- Project Phase；
- Creative Direction；
- Workflow Stage；
- Deliver Stage；
- “理解 / 探索 / 构建 / 决策” Workspace intent；
- 任何对所有项目都强行统一的业务层级。

这些如果有价值，可以作为 Agent / Project 自定义 Metadata / Node presentation / View semantics 表达。

注意：已有后端字段为了兼容可以暂时保留，但 GUI 不应继续强迫用户填写或按它组织产品。

---

# 7. Workspace / Collection / Workbench 保留

## Workspace

继续保持：

```text
Named Camera
+ Spatial Frame
+ Focused View Set
+ Context Policy
+ Projection preference
```

GUI 只需要：

- 命名；
- 定位；
- 框选 / group move；
- resize；
- 视图偏好。

**不再让用户选择固定业务 Intent。**

Workspace 仍然不是：

- History；
- Snapshot；
- Version；
- 文件夹。

## Collection

继续是递归子画布能力。

它表达“进入另一层空间”，但不表达固定业务类别。

## Workbench

继续是临时第一工作现场。

- 不自动进入；
- 可以随时清空 View / Layout；
- 不删除真实 Artifact / Revision / Run / Session；
- 可将稳定结果并回。

---

# 8. Interaction Language：必须像成熟 Canvas，不像后台表单

主要操作：

```text
点
多选
框选
拖
缩放
连线
进入
返回
聚焦
Drop
Undo
Ask Agent
```

GUI 状态优先用：

- 图形；
- 位置；
- 动效；
- 层级；
- hover expansion；

表达。

技术 ID、长状态文字、JSON、路径、日志进入 Inspector / Drawer，不常驻主画面。

Agent 提议重排 / 大改画布时优先采用 iOS 式 ghost preview：

```text
现有位置保留
→ 新位置以轻量 ghost / preview 展示
→ 用户确认或直接拖动接管
```

不要弹“Agent proposes 14 mutations”式数据库审批框。

---

# 9. 视觉与动效目标

关键词：

```text
成熟 Canvas
安静
层级清楚
iOS / macOS 原生感
触控感
低认知负担
```

保留 Phase4 Silk 已经好的东西：

- narrow left rail；
- warm / cool neutral surface hierarchy；
- selected purple → blue → cyan thin rim；
- active run 才有克制 motion；
- Drop ghost / AirDrop 感；
- Workspace mini map / preview；
- 轻量 bottom dock；
- zoom-stable controls；
- 子画布与 Camera 层级；
- direct relation manipulation；
- near-field composer。

不要为了“重构”把已经顺手的部分重新设计一次。

---

# 10. 本轮代码与交互硬门槛（真实踩坑清单）

以下进入实施验收，不是建议。

## 布局

1. 操作图标之间最少留 **6–8px**，禁止 0–1px 贴成一条。
2. 图标 + 文字按钮必须 `flex / inline-flex` 同行，禁止文字从按钮溢出。
3. 下拉 / 更多菜单不能 `flex-grow:1` 撑满整行、挤碎同排按钮。
4. 悬浮 Rail / Minimap / Bottom Dock 必须互相避让，任何小地图不允许被盖住。

## 缩放

5. Canvas 控制图标必须反缩放：Anchor、Edge Control、Selection Toolbar 在缩小画布时仍可点击。
6. Canvas 可交互高度必须截止到底部 Dock 上方，不能让 Dock 覆盖最后一片可点击区域。

## 相机

7. 恢复 Camera 时必须验证顶部 / 左右安全区，不能恢复到被顶栏挡住的状态。

## Drop / Drag

8. Drop 热区必须 **≥ Auto Pan 热区**。
9. 指针离开 Drop 边缘时，边缘激活态必须立即熄灭；已 Stage 的虚影可以继续拖向 Destination Sheet。
10. 虚影拖到 Destination 上松手必须直接投送，不再“松手开面板 → 再点一次”。
11. 投送过程中真实节点保持在原 Canvas 位置，指针拖的是 Ghost。

## 实现

12. 写 CSS 后必须确认对应 DOM 真存在，禁止“只有 selector 没组件”。
13. 改路由 / 分支后必须检查旧 `return` / 旧分支有没有提前短路。
14. 代码改了页面没变化时先排查 dev server / 缓存 / 旧进程，再继续乱改源码。

## 验证

15. 静态检查不能代替手测。每轮至少真实浏览器：**拖一次、缩一次、多选一次、Drop 一次**。
16. 交互测试必须 reset / cleanup。失败测试不能把节点留在几千像素外污染后续测试。

总原则：

> **交互做出来先自己拖一遍、缩一遍、多选一遍，别只看代码和截图。**

---

# 11. 当前正式前端改造方向

以 `frontend-package-20260808-phase4-silk.zip` 为代码基线。

保留 Silk 已完成且体验正确的实现，只纠偏产品语义和交互硬伤。

## 要继续保留

- Phase4 Silk 的 Shell；
- Narrow Workspace Rail；
- Bottom Dock；
- Workbench / Collection / Workspace；
- Dual Drop 与 Ghost staging；
- Camera safe area；
- inverse-scale controls；
- relation cut / reconnect；
- content-first node presentation；
- near-field composer；
- lazy Surface；
- viewport culling；
- reduced motion；
- existing runtime / backend contracts。

## 本轮需要改

1. Bottom Dock 用户层收敛为：整理 / 上下文 / 工作流；
2. Work / Deliver 旧 Surface 仅作为兼容代码，不再成为用户主导航；
3. Run 回到右侧执行列表；
4. Workspace GUI 移除固定 Intent taxonomy；
5. Context Free / Tree / Graph 不再使用项目业务分类 lane；
6. Context Graph filter 根据项目实际 Relation 动态生成，不硬编码关系类别；
7. Project-level ContextSnapshot 不再冒充“当前对话历史”；
8. ConversationContextDialog 增加单对话 Change Navigation Rail；
9. “提升为决策”等 UI 文案改为中性的“标为重点”；
10. Workflow Surface 变成项目自由图，不强制 lane / schema；
11. 右侧 Run Rail 能显示最近执行列表和需要用户关注的状态；
12. 所有 16 条交互硬门槛回归验证。

---

# 12. 禁止重新引入

后续 Agent / Codex 不得自行恢复：

- `Arrange → Context → Run → Deliver` 四阶段产品流程；
- Run 独立页面；
- Deliver 独立底部页面；
- 项目级固定 Context lane；
- “所有 Context 必须 Tree”的规则；
- 固定 Workflow Step schema；
- Workspace 固定业务 Intent；
- Session → Decision → Summary 等强制 Canonical hierarchy；
- 业务节点只能出现在某个 Mode；
- 因为视觉对称而发明新业务模块。

---

# 13. 最终验收体验

用户第一次打开应能迅速理解：

```text
左边：去哪
下边：想做哪类工作
中间：自由搭
右边：Agent 现在执行到哪
```

熟练以后又不会撞到系统预设的业务栏杆。

任意项目都可以长得完全不同，但都具备一致、成熟的 LCOS 操作语言。

最终一句：

> **LCOS 的外壳负责让能力容易理解，Canvas 负责保持自由，本地 Agent 负责根据每个项目自己的理解搭结构；Core 记录事实，不替项目发明语义。**
