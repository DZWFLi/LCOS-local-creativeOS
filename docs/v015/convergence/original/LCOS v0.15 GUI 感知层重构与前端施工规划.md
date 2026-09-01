# LCOS v0.15 GUI 感知层重构与前端施工规划

> 日期：2026-08-26  
> 性质：GUI 重构施工总纲 / Codex 交接稿  
> 适用基线：当前 `frontend-focus` 最新前端源码 + 2026-08-26 v0.15「宝可梦图鉴 / 装配台」系列文档 + 本轮最新收敛判断  
> 核心原则：**尽量不改 LCOS 已经成熟的逻辑与操作位置，重构“人看到什么、什么时候看到、怎样看懂”。**

---

# 0. 先把结论钉死

LCOS v0.15 这一轮不是“重做一套画布”，也不是“在现有卡片上贴一层宝可梦皮”。

真正的目标是：

> **保住 0.1 已经成熟的 Spatial / Drop / Focus / Search / Context / Workflow / Runtime / Skill 底座，重新设计 GUI 的感知层，让主画布从“很多长得差不多的组件 + 很多线 + 很多状态”收敛成一个真正能被人一眼看懂的空间。**

新的视觉优先级必须固定为：

1. **Glyth / Bloub 对话生物**：一级视觉主角。
2. **Spatial Beacon / 导航游标**：第二重要的空间指引。
3. **Artifact Body**：用户真正工作的内容实体。
4. **Colony / 菌落场**：非常轻的软性编组语法。
5. **Light Segment / Matrix / Edge / Runtime Field**：二线状态语言，只在明确交互或运行状态中增强出现。

因此主画布的默认状态必须是：

> **静、稀、少、可认。**

而不是每一个对象都展示自己的类型、状态、边界、连线、标签、组件结构和运行效果。

这一版最重要的施工判断还有四条：

- **不把 `nest` 当成 P1。** 现有“没有真树形”的状态并不是当前 GUI 的主要问题。只要视觉层级清楚、选择和装配逻辑成立，菌落完全可以继续是软关系。
- **不继续把 Surface Component 做成自由画布里的小型 SaaS 面板。** 组件应该退回“视觉整理原语”。
- **复杂布局交给 Skill。** 前端只提供可靠、确定、可撤销的最小排列动作。
- **Assembly 必须独立成 Workspace。** 底层仍然复用 Semantic Drop，但 GUI 不再挤在“加号小菜单 / 子画布”里。

---

# 1. 当前源码里其实已经有的东西

这点非常重要，因为这轮最大的风险不是“能力不足”，而是重复造轮子。

## 1.1 Bloub 已经不是外部概念，而是已经进源码了

当前源码已经存在：

```text
src/features/spatial/visual/glythBloub.ts
src/features/spatial/visual/bloub/*
```

并且已经完成：

```text
LCOS Glyth 七态
→ bloub 形态状态
```

现有映射已经包含：

```text
stable
working
waiting
error
confirm
absorb
output
```

也就是说：

> **“一只对话 = 一只 Bloub / Glyth”不需要重新引入动画引擎。**

下一步应该做的是：

- 把现有 Glyth 从“视觉 Accent”升级为真正的 Conversation Projection Body；
- 把同一份 Bloub 渲染器收口到主画布、Context、Workflow 和 Rail 的统一身份表达；
- 不再额外发明“note 水滴 / source 彗星 / context 双细胞”这一套对象物种。

**一个 Bloub 对应一个对话。**

Artifact、Context、Workflow、Collection 不再争夺“生物身份”。

## 1.2 Matrix Activity 已经存在

当前源码已经有：

```text
MatrixActivity
MatrixVerb:
gather / spread / gap / flow / pull / break / absorb / emit
```

并且 `active=false` 时直接不渲染。

这恰好符合现在的方向：

> Matrix 不应该常驻，它就是一个“需要时出现”的活动纹理。

所以不要再做一套新的点阵状态机。

应该做的是：

```text
默认：Matrix = OFF
选中：局部 ON
Focus：目标周围 ON
Search handoff：目标 ON
Agent arrange preview：涉及对象 ON
Run / processing：真正执行对象 ON
error：局部语义红
```

## 1.3 Focus 的底层定位已经成熟

现有源码已经有：

```text
ProjectFocusNavigator
useSpatialFocusRequest
fitSpatialBounds
```

并且当前产品心智已经明确：

```text
Ctrl/Cmd + F = Search
F = 当前 Selection 的 Focus / 在哪
```

Focus 本身是：

> **只读定位，不改变 Selection，不改变 Presentation membership。**

所以 Spatial Beacon 不应该重新发明一套“查找系统”。

它只应该成为：

> **Focus / Search / Agent Locate 的统一视觉反馈层。**

底层定位继续用现有 Focus。

## 1.4 Semantic Drop 已经是正确底座

现有 Semantic Drop 已经支持主画布、Context、Workflow、Rail，以及 secondary pointer / handle / Alt-primary 等入口和 drop target 命中。

因此 Assembly Workspace 的关键原则必须写死：

> **新 GUI，旧 Drop。**

不要为 Assembly 新造第二套拖拽协议。

## 1.5 ELK / fCoSE 已经真正接进来了

当前源码已经有：

```text
elkDriver.ts
cytoscapeFcoseDriver.ts
layoutService.ts
```

所以它们不该删除。

但产品职责要下降：

```text
ELK / fCoSE
= Geometry Engine / Agent Skill 的可调用能力
≠ 用户画布默认自动整理器
```

主画布仍以 Freeform / Manual 为基准。

## 1.6 Skill 基础也已经存在

当前 Workflow 已经能：

```text
编排
→ 序列化成 SKILL.md
→ 保存为项目 Artifact
→ 重放
```

所以“复杂排列由 Skill 完成”不是未来幻想，而是可以直接延续现有架构。

---

# 2. 冻结不动的 GUI 大结构

这轮不要碰：

- 顶部项目级入口的大体位置；
- 左侧 Rail 的位置；
- 右侧 Work Rail 的位置；
- 底部 Main / Context / Workflow 三视图切换位置；
- SpatialCanvas 作为共同空间底座；
- 主画布 / 对话子现场 / Context / Workflow 的现有路由大逻辑；
- Search / Focus 心智；
- Semantic Drop；
- Project Truth / Presentation 分离；
- Runtime / Bridge / Artifact Return 等执行链。

这轮主要动：

```text
Entity 的视觉身份
Interaction Feedback
Surface Component 的呈现职责
Focus 的空间反馈
Assembly 的独立 GUI
Skill 与 Layout 的职责边界
Sound Feedback
```

一句话：

> **不搬家具，重新设计这间房里什么最醒目、什么时候亮灯、什么东西平时应该藏起来。**

---

# 3. 主画布新的视觉层级

## 3.1 Level 1：Glyth

Glyth 是整张画布里最容易被眼睛识别的对象。

它不应该：

- 躲在卡片左上角；
- 成为某种“小徽标”；
- 和 Artifact 卡片共享同等视觉重量。

它应该：

- 独立存在；
- 有明确的轮廓和微弱生命感；
- 在静止时非常克制；
- 被点击时明显“活起来”；
- 运行时通过形态变化表达状态，而不是靠一堆文字 Badge。

### 默认态

```text
尺寸：保证中等缩放下仍然能认出
Body：纯净、强轮廓
Eyes：保留角色性
Animation：低频、低振幅
持续状态光：无
持续粒子：无
持续发光：无
```

### 状态优先使用形态，而不是颜色

建议：

```text
stable   → 安静
working  → thinking / 微形变
waiting  → notify / 视线变化
error    → alert + 语义红
confirm  → wink
absorb   → comet / 收束
output   → burst / 释放
```

颜色只承担：

```text
error
selection
focus
```

不要让不同 Agent 全靠不同彩色来区分。

Agent 身份优先通过微小肩标、眼睛 / 配件差异、名称和可选形态变体来做。

---

# 4. Glyth 单击交互：不要再弹矩形信息卡

旧文档写：

```text
单击
→ NodeInfoPopover
```

这个判断需要更新。

对于普通 Artifact，NodeInfoPopover 仍然有价值。

但对于 Glyth：

> **单击应该产生“从身体里长出来”的环绕式信息展开，而不是再弹一张 SaaS 卡片。**

暂定名：

```text
Glyth Orbit
```

## 4.1 动画

单击后：

1. Glyth 本体轻微放大；
2. 4～6 个小信息点从身体附近释放；
3. 以半环 / 不完整轨道绕在 Glyth 周围；
4. 每个点先只有图标 / 极短 label；
5. hover / keyboard focus 后才展开小文字；
6. 再次点击空白或 Esc 收回；
7. 所有点按反向轨迹缩回 Glyth。

不要做完整圆盘菜单。

应该像：

> 一只生物短暂把自己的“状态器官”展开给你看。

## 4.2 Orbit 信息内容

建议最多六个：

```text
① 当前身份 / Agent
② 正在干什么
③ 最近产出
④ 当前参与的 Context / Workflow 数
⑤ 去它的现场
⑥ 血统 / Activity
```

其中只有“进入现场”是明显的 primary action。

其他都是信息入口。

## 4.3 进入子画布

建议统一：

```text
单击 = Select + Orbit
双击 = Enter conversation scene
Enter = Enter conversation scene
Orbit 中“进入” = Enter conversation scene
```

这样和 LCOS 原有：

```text
Click = Select
Double Click / Enter / Explicit Open = Open
```

保持一致。

---

# 5. 对话子画布：详细内容仍然藏在里面

对话 Glyth 的真正详细信息不要塞回主画布。

进入后：

```text
项目
› 某对话
```

这里才展示：

- 它自己的 Artifact；
- 它引用的材料；
- 它产生的 Context；
- 它参与 / 产生的 Workflow；
- 历史产出；
- Run / Review；
- 详细关系。

底部依旧：

```text
Main / Context / Workflow
```

所以结构是：

```text
主画布
= 低密度身份层

Glyth Orbit
= 中密度摘要层

对话 Scene
= 高密度工作层
```

这三个层级必须严格分开。

---

# 6. Spatial Beacon：第二重要的视觉标志

这是 v0.15 必须专门做成组件的东西。

暂定文件：

```text
src/features/spatial/visual/SpatialBeaconLayer.tsx
```

它不负责“搜索”。

它只负责：

> **把现有 Focus / Search result / Agent locate 的世界坐标，翻译成用户能立即理解的空间方向。**

## 6.1 三阶段表现

### A. 目标完全在视口外

屏幕边缘出现：

```text
方向箭头 / 尖角游标
+ 极短对象名
+ 距离感
```

不要地图 Pin。

### B. 摄像机正在接近目标

Beacon 从 screen-space 逐渐：

```text
靠近世界坐标
→ 缩短距离提示
→ 减少文字
```

### C. 目标进入视区

Beacon 消失。

目标本体：

```text
轻 pulse 1～2 次
+
Artifact / Glyth 周围状态场短暂增强
```

然后恢复安静。

## 6.2 Beacon 的触发来源

只允许：

```text
F Focus
Search → Focus
Rail Locate
Agent “帮我找到…”
Assembly Return
跨 Surface 跳转
```

不要让普通 hover 产生 Beacon。

## 6.3 与 MiniMap 的关系

MiniMap 继续存在，但地位下降。

用户正常找东西不应该盯着缩略小地图找一个微小方块。

Beacon 才是第一导航反馈。

MiniMap 负责：

```text
整体空间感
大范围地图认知
手动远距离导航
```

Beacon 负责：

```text
“我要找的东西在哪”
```

---

# 7. Artifact Body：内容必须重新成为内容

主画布中除了 Glyth，最重要的是 Artifact。

Artifact 不需要变成另一个“物种”。

它应该保持：

```text
document
image
url
note
output
skill
```

这些内容自身最适合的视觉形式。

例如：

- 图片就是图片；
- 文档是清楚的纸面缩略；
- 文本是可读大纲；
- URL 是网页截面 / favicon + title；
- Skill 是极简能力块；
- 输出是实际内容预览。

不要为了统一而统一成同款卡片。

---

# 8. Artifact Selection 必须重做

当前一个明显问题：

> 选中以后“不够像选中了”。

新 Selection 应该包含三层，但都很轻。

## 8.1 Body 状态

```text
边缘提亮
局部角线
轻微对比度提升
```

不建议大面积填色。

## 8.2 Local Field

选中对象周围出现：

```text
很淡的局部状态场
```

它不是 Glow。

更像：

```text
磁场
扫描区
局部空间被激活
```

半径不要太大。

## 8.3 Relationship Reveal

Selection 后才允许增强：

- 直接一度关系；
- provenance；
- Active Path；
- 输入输出方向。

默认全部弱化。

多选时：

```text
每个对象局部 Field
+
整个 Selection 的极淡共享场
```

不要用一个巨大的矩形 Bounding Box 统治视觉。

---

# 9. 二线视觉语法：默认隐藏，事件时出现

这是整个 v0.15 最重要的降噪规则。

## 9.1 Edge

默认：

```text
opacity 极低
或仅关键 edge 可见
```

增强条件：

```text
Select
Hover with intent
Focus
Search handoff
Run
Agent rearrange
Relationship lens
```

## 9.2 Light Segment

用途：

```text
进度
当前路径
checkpoint
选择反馈
```

默认：

```text
off / dim
```

运行时才：

```text
flow
progress
complete
```

## 9.3 Matrix Activity

只表达：

```text
processing
flow
absorb
emit
gather
```

默认永远 off。

## 9.4 Runtime Field

不要每个节点都挂一个状态 Badge。

运行对象：

```text
局部 Field
+ Glyth 形态
+ Matrix / Segment
```

完成后快速衰减。

---

# 10. Colony / 菌落：视觉编组，不是文件夹

这里需要明确推翻旧方案里“马上补 nest”的冲动。

## 10.1 当前阶段不要新增真树形 Surface Nest

原因不是做不到，而是当前需求并不需要。

用户真正需要的是：

```text
这些东西看起来属于一组
这些东西可以一起选
这些东西可以被 Skill 整理
这些东西可以被装配
```

而不是：

```text
每个对象必须拥有 parentId
```

因此：

> `surfaceOps.ts` 暂时不要新增 `nest / unnest` 作为 v0.15 主施工。

只有未来出现：

```text
必须持久化的 membership 语义
必须跨 Surface 保证的组身份
```

再单独设计。

## 10.2 Colony 视觉

不要 Fence 那种“框”。

建议：

```text
不闭合边界
局部弧线
少量角点
极淡底纹差异
标题像培养皿编号一样附着
```

边界的存在感：

```text
Idle       10～15%
Hover      25%
Selected   40%
Agent edit 45%
```

## 10.3 Colony 的行为

允许：

```text
选择一组
移动一组
命名
折叠视觉
让 Agent 整理
送入 Assembly
```

不要求：

```text
树形父子
内部强制坐标约束
自动吸附容器
```

---

# 11. Surface Component 体系：从 SaaS 卡片改成视觉整理原语

当前 15 个组件不要“一刀全删”。

真正要做的是职责重编。

## 11.1 组件的新定义

旧：

> 一个组件 = 一块有自己标题、边框、内容、操作的迷你应用。

新：

> **一个组件 = 帮助 Artifact 被看懂、比较、归纳、排列的视觉原语或临时观察方式。**

## 11.2 15 个组件清算建议

| 当前组件 | 新角色 | 处理 |
|---|---|---|
| Fence | Colony visual skin | **主入口废弃，能力化用** |
| Region | 临时 Selection / Focus Field | **保留底层，不作为常驻组件** |
| Portal | 轻量跨现场入口 | **保留，去卡片化** |
| Source Chain | 来源路径 / 血统轨迹 | **保留逻辑，改成 Path / Ribbon** |
| Structure Map | 结构归纳 | **核心保留** |
| Evolution | 时间 / 版本演进 | **核心保留** |
| Relationship Field | 关系观察 | **重做，禁止继续做列表** |
| Context Pack | Context Bundle | **压缩成包 / 束 / 小型摘要入口** |
| Stack | Artifact 堆叠 | **核心视觉原语** |
| Compare | 临时对比场 | **核心保留，但不常驻成大面板** |
| Workflow Step | Workflow 内的步骤对象 | **只在 Workflow 强表达** |
| Review | Review 状态 / Checkpoint | **Workflow 核心保留** |
| Checkpoint | 时间锚点 | **保留，轻量化** |
| Active Path | 当前执行路径 | **保留，但默认隐藏** |
| Workbench | 真正复杂工具宿主 | **保留，但只在需要时进入** |

---

# 12. 新的“视觉整理原语”建议

Surface Catalog 后续可以逐渐从“Component Catalog”改造成：

```text
Curation Primitive Catalog
```

优先补的不是更多业务卡片，而是：

```text
Align
Distribute
Grid
Stack
Sequence
Outline
Mind Map
Relationship
Timeline
Compare
Bundle
Wave / Signal
```

## 12.1 Button → Reveal

很多组件不要永久占画布。

例如 Context Bundle 默认只显示一个小 Bundle 标记。

点击：

```text
展开为临时 overlay / popover
```

关闭后：

```text
画布恢复安静
```

## 12.2 Wave / Signal

Context 里已经存在 Signal Track / Evolution 的成熟基础。

它们应该成为视觉整理的核心语言之一，而不是再做第二套“Context 表格”。

## 12.3 Outline

文本型信息归纳：

```text
大纲
树
层级文本
```

仍然是最强的“人一眼看懂”形式之一。

不要为了“画布感”把所有文本都拆成小卡。

## 12.4 Mind Map

Mind Map 只在“结构” Lens 中出现。

它不是主画布默认语法。

---

# 13. Context / Workflow：这里可以比 Main 更结构化

主画布极简，不代表所有页面都要极简。

## 13.1 Context

Context 本质是：

> 理解现场。

因此可以保留：

```text
Structure
Evolution
Relationship
Signal
```

这些较强的结构化呈现。

但不要：

- 四个 Lens 长得像四个 SaaS 卡片；
- 用大量独立 panel 分隔；
- 让用户选“底层算法模式”。

Context 第一职责是：

> 让人能快速理解这批材料为什么在一起、怎么演进、哪里重要。

## 13.2 Workflow

Workflow 本质是：

> 正确执行路径 + 状态 + Review。

因此这里可以明显展示：

```text
Step
Active Path
Input / Output
Checkpoint
Review
Run state
```

但仍然应该控制密度。

尤其 Active Path 只有当前执行或用户查看时强亮。

---

# 14. Assembly Workspace：独立装配空间

这是当前 UX 文档最需要更新的一块。

旧：

```text
加号
→ 弹一个装配面板
```

新：

> **Assembly 是独立 Workspace。**

不是：

- 子画布；
- modal；
- 右栏；
- Surface Component。

## 14.1 入口

可以从：

```text
底部 +
Glyth Orbit
Context
Workflow
Selection
Rail
```

进入同一个 Assembly Workspace。

入口不同只决定：

```text
target
preset filter
```

## 14.2 第一屏：全项目 Warehouse

Warehouse 必须覆盖整个项目的可装配对象。

不是当前画布的清单。

必须能索引：

```text
Conversations
Artifacts
Collections
Context
Workflow
Workspace / Scene
Skills
External Resources
Useful Components / Curation Primitives
```

“列得全”指数据覆盖全，不代表屏幕上同时铺满。

## 14.3 Warehouse 的视觉

不要做文件管理表格。

建议：

```text
每一类一个空间岛
岛内是小浮标 / 小实体
```

类别：

```text
对话
内容
上下文
工作流
工作现场
技能
外部资源
```

可提供：

```text
Search
Filter
Recently Used
Used Here
```

但默认仍然是空间化浏览。

## 14.4 第二屏：左右分屏装配

进入某个类别或开始装配后：

```text
左：Target Scene
右：Warehouse
```

或者根据操作习惯镜像，但全产品固定一个方向。

### 左侧 Target Scene

显示：

```text
当前对话 / 当前 Context / 当前 Workflow / 当前 Scene
已有成员
当前装配关系
```

### 右侧 Warehouse

显示：

```text
全项目可用对象
分组
搜索
筛选
来源
```

## 14.5 Drop 仍然是唯一核心动作

```text
Warehouse
→ drag
→ Target
```

底层继续走：

```text
Semantic Drop
```

不要增加：

```text
选择
→ 下一步
→ 确认类型
→ 选择绑定方式
```

这些表单式流程。

## 14.6 Assembly 的归属原则

装配代表：

```text
“这里要用它”
```

不是：

```text
“它从此属于这里”
```

所以：

> **usage / membership 可以增加，provenance 永远保留。**

“产出不绑来源”的正确解释是：

```text
使用权解绑
≠ 血统删除
```

---

# 15. Left Rail / Work Rail 的新职责

## 15.1 Left Rail

继续用现有 `WorkspaceRailVNext`。

从类型式暂存 / Scene 列表进一步向：

> **Project Shelf / 图鉴收集架**

收敛。

它不是完整 Warehouse。

Warehouse 在 Assembly 里。

Rail 只展示：

```text
高频
收藏
最近
当前项目重要现场
常用对话
```

所以：

```text
Rail = 快捷架
Assembly Warehouse = 全量仓库
```

二者不要混淆。

## 15.2 Work Rail

当前 Run / Review / Composer 能力保留。

视觉上改成：

> **Agent Activity Stream / 招式播报**

重点回答：

```text
谁
正在做什么
作用于哪个对象
刚产生了什么
要不要我确认
```

而不是运行系统日志。

---

# 16. Layout：前端只保留确定性动作，复杂排列交给 Skill

这是必须写进施工纪律的一条。

## 16.1 前端直接提供

只需要这些：

```text
Align Left
Align Center
Align Right

Align Top
Align Middle
Align Bottom

Distribute Horizontal
Distribute Vertical

Grid
Rows
Columns
Stack
Tidy Gap
Pack Selection
```

它们特点：

```text
确定
快速
无需模型判断
可撤销
```

## 16.2 ELK / fCoSE 的角色

继续保留。

但放到：

```text
Context / Workflow 的结构化 Lens
Agent layout proposal
Skill 内部 layout engine
```

而不是：

```text
主画布自动一键“聪明整理”
```

## 16.3 复杂排布由 Skill 做

正确流程：

```text
Agent
先 inspect
→ 理解材料
→ 决定分组
→ 决定 emphasis
→ 决定关系
→ 调用排列原语 / layout engine
→ Ghost Preview
→ 用户接受
```

而不是前端实现一个越来越复杂的自动排版状态机。

## 16.4 LCOS 建议新增的 Curation Skill

第一批：

```text
canvas-cleanup
canvas-group-by-topic
canvas-compare
canvas-build-outline
canvas-build-context-map
canvas-build-workflow
canvas-arrange-presentation
canvas-highlight-decisions
```

每个 Skill 要输出：

```text
membership proposal
relation proposal
emphasis
layout intent
optional position patch
```

而不是直接乱改 Project Truth。

---

# 17. Sound Feedback：做一套 Sonification Layer

LCOS 确实应该有声音。

但声音最容易从“高级”变成“QQ 空间”，所以必须做事件等级。

## 17.1 建议技术

### 方案 A：Howler.js

适合：

- sound sprite；
- 全局音量；
- mute；
- 多声音并发；
- 浏览器兼容；
- 后续 Desktop 继续复用。

推荐作为 LCOS 正式音频运行层。

### 方案 B：Web Audio API

适合：

- 很少的短音效；
- 想彻底避免依赖；
- 需要程序生成轻微 click / tone。

但维护细节更多。

### 不建议

```text
Tone.js
```

对 LCOS 这种 UI sonification 太重。

## 17.2 音效事件分级

### Tier 0：无声音

```text
hover
普通 select
普通 pan
普通 zoom
每一个 drag tick
```

全部静音。

### Tier 1：轻触觉级

可选极轻：

```text
drop accept
snap / align 完成
assembly slot 接收
Glyth Orbit 打开
```

50～100ms。

### Tier 2：动作完成

明显但短：

```text
Agent task complete
Render complete
Import complete
Assembly commit
Review accepted
```

### Tier 3：注意

```text
Waiting Input
Review required
Error
Conflict
```

不能和 Tier 2 共用同一声音。

## 17.3 音效风格

不要：

```text
游戏金币
系统通知叮
机械键盘拟真
大片科幻 whoosh
```

应该像：

```text
短
干净
有实体感
偏电子设备 / 编辑软件
少混响
少低频
```

## 17.4 音频控制

必须有：

```text
Mute
UI Feedback Volume
Task Notification Volume
Reduced Motion / Reduced Feedback 联动
```

并支持浏览器首次交互后 unlock audio。

## 17.5 新文件建议

```text
src/features/sound/
  soundEngine.ts
  soundEvents.ts
  useUiSound.ts
  soundPreferences.ts
```

接口不要散落：

```ts
emitUiSound('drop.accept')
emitUiSound('run.complete')
emitUiSound('review.required')
```

---

# 18. 成熟方案：哪些直接拿，哪些别再手搓

## 18.1 Bloub

**现状：已经 vendored。**

继续用它的：

- SVG morph；
- state sampling；
- gaze；
- 动画时间；
- state transition。

不要重新写 blob morph。

但公共发布要注意：

> 开源仓库的 MIT 许可覆盖代码，不代表 x.ai / Grok 的视觉设计本身被授权。

因此建议：

```text
v0.15 内部原型
→ 继续直接用

LCOS 正式公开品牌
→ 保留引擎与形态语法
→ 重绘成 LCOS 自己的 Glyth species
```

不要让 LCOS 最重要的品牌视觉永久依赖“复刻 Grok”。

## 18.2 Motion

当前项目已经有：

```text
motion
```

所以 Orbit、Beacon transition、Field pulse、Assembly workspace transition 优先用现有 Motion。

不要再加 GSAP。

## 18.3 Base UI

项目已经有：

```text
@base-ui/react
```

所以 Menu、Popover、Dialog、keyboard / focus、accessible primitive 不要再引入第二套 Radix / Headless UI。

## 18.4 Sonner

项目已经有：

```text
sonner
```

继续负责：

```text
toast
text notification
```

声音不要绑死在 toast 组件里。

Sound Engine 独立。

## 18.5 ELK + fCoSE

继续保留。

不要换 React Flow / xyflow。

LCOS 已经有自己的 SpatialCanvas、Presentation Truth 和 Drop 语义，换图框架只会把整个成熟底座炸掉。

## 18.6 Huabu

真正值得吸收的不是它的视觉。

而是：

> **Agent 通过 Skill 对 Space 做整理，而不是 UI 硬编码越来越复杂的自动排布逻辑。**

这条直接进入 LCOS 的长期架构原则。

---

# 19. 文件级施工地图

下面按“尽量不改逻辑”的原则拆。

## P0：先让世界安静下来

### 修改

```text
src/features/spatial/visual/spatialSignal.ts
src/interaction-system.css
src/features/spatial/components/spatial-components.css
src/features/canvas/ProjectCanvas.tsx
src/features/canvas/CanvasNodeVisual.tsx
```

### 内容

- Edge 默认降噪；
- Matrix 默认关；
- Light Segment 默认弱；
- Artifact selection 加强；
- selected local field；
- Focus / Search / Run 时再增强。

## P1：Conversation Glyth 正式成为主角

### 复用

```text
src/features/spatial/visual/glythBloub.ts
src/features/spatial/visual/bloub/*
src/features/spatial/visual/CanvasSprite.tsx
```

### 新增建议

```text
src/features/conversations/ConversationGlyth.tsx
src/features/conversations/GlythOrbit.tsx
src/features/conversations/glythProjection.ts
```

### 修改

```text
CanvasNodeVisual.tsx
ProjectCanvas.tsx
projectEntityProjection.ts
```

### 验收

- 一个 conversation = 一个 Glyth；
- 无默认矩形脸卡；
- 单击展开 Orbit；
- 双击 / Enter 进入 conversation scene；
- 状态由现有 Glyth state 驱动。

## P2：Spatial Beacon

### 新增

```text
src/features/spatial/visual/SpatialBeaconLayer.tsx
src/features/spatial/visual/spatialBeaconGeometry.ts
```

### 复用

```text
ProjectFocusNavigator.tsx
useSpatialFocusRequest.ts
spatialCamera.ts
```

### 修改

```text
CanvasSceneHost.tsx
ProjectionSurfaces.tsx
各 Spatial Surface
```

### 验收

- offscreen 有方向；
- approaching 有收敛；
- onscreen 目标 pulse；
- 不修改 Selection / Membership；
- F / Search / Rail / Agent locate 共用。

## P3：Colony 重画，但不加 Nest

### 修改 / 化用

```text
FenceComponent.tsx
RegionComponent.tsx
surfaceGeometry.ts
spatial-components.css
```

### 不动

```text
surfaceOps.ts
```

至少这一阶段不要新增：

```text
nest
unnest
reorder-nest
```

## P4：Component 清算

### 核心文件

```text
surfaceComponentCatalog.ts
surfaceComponentRegistry.tsx
MainComponentRenderers.tsx
ContextComponentRenderers.tsx
WorkflowComponentRenderers.tsx
SourceChainComponent.tsx
SurfaceComponentShelf.tsx
```

### 目标

把“组件”逐步拆成：

```text
Persistent Primitive
Temporary Lens
Workflow-only Component
Workbench Host
```

## P5：Assembly Workspace

### 新增建议

```text
src/features/assembly/
  AssemblyWorkspace.tsx
  AssemblyWarehouse.tsx
  AssemblyTargetScene.tsx
  AssemblyCategoryIsland.tsx
  assemblyIndex.ts
  assemblyDropAdapter.ts
  assemblyState.ts
```

### 复用

```text
semanticDrop
WorkspaceRailVNext
Project entity / presentation indexes
SurfaceObject
SpatialCanvas
```

### 修改入口

```text
SurfaceDock.tsx
SurfaceComponentShelf.tsx
GlythOrbit.tsx
WorkspaceRailVNext.tsx
```

其中原来的：

```text
+
→ SurfaceComponentShelf menu
```

逐步改成：

```text
+
→ Assembly Workspace
```

小型视觉 primitive 的快捷添加可以保留 secondary shortcut。

## P6：Curation Layout + Skill

### 新增 GUI 原语

```text
align
distribute
grid
row
column
stack
pack
```

建议放：

```text
src/features/layout/curationPrimitives.ts
```

### 继续复用

```text
layoutService.ts
elkDriver.ts
cytoscapeFcoseDriver.ts
```

### Agent 侧

新增 canvas curation 类 Skill。

复杂 layout 不塞进 React 状态机。

## P7：Sound

### 新增

```text
src/features/sound/*
```

### package

建议新增：

```text
howler
```

如果第一轮只做 4～5 个轻反馈，也可以先 Web Audio 原生实现，再决定是否引入 Howler。

---

# 20. 旧文档里应该正式废弃 / 修正的判断

## 废弃 1

旧：

> 画布上一切视觉平权。

改：

> 数据身份可以平权，视觉绝对不平权。

## 废弃 2

旧：

> Bloub 与 Artifact / Component 都是同类“宝可梦”。

改：

> **Bloub 只代表 Conversation。**

Artifact 保持 Artifact。

## 废弃 3

旧：

> P1 立即新增真 nest。

改：

> Colony 先做视觉软关系；真实 nest 暂缓。

## 废弃 4

旧：

> 加号本身就是装配台。

改：

> 加号只是进入 Assembly 的入口之一。

## 废弃 5

旧：

> Assembly = 大弹窗 / 子画布。

改：

> Assembly = 独立 Workspace。

## 废弃 6

旧：

> Matrix 三视图“从零缺失”。

改：

> Matrix renderer / CSS 基础已经存在，问题是接入策略和触发规则没有收口。

## 废弃 7

旧：

> 复杂自动排布继续由前端 Layout 系统增强。

改：

> 前端只做确定性排列原语；复杂语义整理以 Skill 为主，ELK / fCoSE 作为引擎。

---

# 21. 分阶段施工顺序

## Session 0：冻结 Baseline

只做：

```text
截图
interaction inventory
source anchor
test baseline
```

禁止 patch。

## Session 1：Quiet Canvas

完成：

- Edge 默认降噪；
- Matrix 条件显示；
- Segment 条件显示；
- Artifact selected field；
- Focus target pulse。

这一轮结束后，哪怕 Glyth 还没改，GUI 都应该明显干净。

## Session 2：Conversation Glyth

完成：

- conversation projection；
- existing Bloub engine；
- Orbit；
- enter scene；
- run status mapping。

这是 v0.15 最大视觉跃迁。

## Session 3：Spatial Beacon

完成：

- offscreen；
- approach；
- arrival；
- Search / Focus / Rail / Agent locate。

## Session 4：Colony + Primitive 清算

完成：

- Fence 去围栏化；
- Region 退底层；
- Stack / Compare / Structure / Evolution 第一轮重绘；
- Relationship Field 去列表化。

## Session 5：Assembly Workspace

完整做：

```text
Warehouse
Category
Target
Semantic Drop
Return
```

必须一次把主路径跑通，不能做一个只能看的仓库页面。

## Session 6：Skill-first Layout

完成：

- deterministic primitives；
- Agent proposal；
- ghost；
- apply / reject；
- pinned preservation。

## Session 7：Sound

最后接。

因为只有 GUI 状态机收口以后，声音事件才不会跟着反复改。

---

# 22. v0.15 最终人类体验验收

## 主画布 3 秒测试

第一次打开项目，3 秒内应该能回答：

```text
这里有哪些主要对话？
我现在在哪？
最重要的内容是什么？
当前有没有东西正在运行？
```

如果需要读 legend，失败。

## 画布 10 秒测试

10 秒内应该能：

```text
找到某个对象
看出一个组
进入一个对话
理解一个 Artifact 的来源
```

不需要查小地图。

## Selection 测试

点一个 Artifact：

```text
必须明显知道选中了谁
必须明显看到最相关关系
其他东西不应该突然全部亮起来
```

## Glyth 测试

点一个 Glyth：

```text
不弹 SaaS 卡片
能看到摘要
能进入现场
状态表达优先靠形态
```

## Assembly 测试

用户从任何现场进入 Assembly：

```text
都能找到全项目对象
都能看懂目标在哪边
拖过去就是用
退出后原位置 / 血统不丢
```

## Skill Layout 测试

用户说：

> “帮我把这里按创意方向整理一下。”

应该：

```text
Agent 判断
→ Preview
→ 用户看到变化
→ Accept / Reject
```

而不是 UI 暴露：

```text
ELK
fCoSE
Force
Hierarchy
```

这些词。

---

# 23. 最后的产品判断

LCOS 现在已经不是“功能还不够”。

真正的问题是：

> **已经有很多能力，但这些能力同时争夺人的注意力。**

v0.15 不应该继续增加 GUI。

它应该做一件更难但更值钱的事：

> **把已经存在的能力重新排出主次。**

最后画布应该像：

```text
一群活着的对话
+
一批真正的项目材料
+
少数安静的空间组织信号
```

而不是：

```text
一个装了 AI 功能的白板 SaaS。
```

如果这一轮做到位，LCOS 的差异就不再是“它也能让 Agent 操作画布”，而会变成：

> **它第一次把 AI 对话、项目材料、上下文、工作流和执行状态组织成一个人可以长期居住的项目空间。**

这才是这一轮 GUI 重构真正值得追的东西。
::: ​​