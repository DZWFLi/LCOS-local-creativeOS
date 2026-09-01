# LCOS v0.15 · 原文回源审判索引
## 当前 GUI 问题 → 最初产品裁决 → 原始文档 → 当前偏差 → 修复动作

日期：2026-08-31  
性质：**在 Full E2E 之前必须完成的 First-Principles / Original-Source Conformance Audit**

> 目的不是重新设计 LCOS。
>
> 这份索引只回答一件事：
>
> **“我们今天随便点两下就发现的问题，当初原文到底怎么规定的，现在是哪一层施工忘了。”**

---

# 0. 总判定

当前 v0.15 GUI 的主要失败，不是缺功能，而是：

```text
原始产品裁决
→ 被施工拆成多个 patch / session
→ 后续 Agent 没有回读原稿
→ 每个局部只实现“代码上能跑”
→ 共用交互 / component morphology / direct manipulation 逐渐失真
→ 最终出现“功能存在，但产品语法消失”
```

最典型的事实：

1. **三 Surface 共用交互**早在 2026-08-21 就是 S0 地基，不是 8/31 新要求。
2. **Structure / Evolution / Relationship 是组件，不是页面**早在 8/21 明确冻结。
3. **Context / Workflow 是自由桌面**早已冻结，不是操作间 / 管理器。
4. **Skill Builder 复用 Text Outline + Mind Map + Direct Manipulation**是 8/30 明确冻结，不是卡片列表。
5. **Drop = 在这里使用**在 8/14 就已经是产品原则。
6. **每个 Session 未过 Acceptance 不得进入下一 Session**在 8/16 就是硬施工纪律。
7. **“接口已存在所以算完成”明确被禁止**，但这次大量问题正是这种“代码层完成、GUI 没接真”的结果。

---

# 1. 原始文档权重

## ROOT-0｜产品哲学根

### `LCOS_ROADMAP_OPEN_SOURCE_LAUNCH_PLAN_20260814_v3.md`

冻结：

```text
Entity First
Surface Second
No Clone / No Ownership Trap
Executor Replaceable
Drop = 在这里使用
```

原文明确：

> 用户 Drop 的语义是“我想在这里使用它”，不是“移动 / 复制 / 引用三选一”。

用途：
- Project Truth
- Surface Projection
- Drop 语义
- 不复制对象

---

### `LCOS_0.1_Product_Continuity_Reframe_20260814.md`

冻结：

> LCOS = Project Continuity Layer

用途：
- 为什么 Project 比 Chat/Session 稳定
- 为什么 Surface / Agent / Harness 都不能拥有第二份 Truth
- 为什么产品目标不是堆更多管理 UI

---

# 2. 施工纪律根

## `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`

这是当前最应该重新给所有 Agent 强制阅读的 SOP 原文之一。

原文每 Session：

```text
Read
→ Audit current consumer / data path
→ Implement the smallest authoritative path
→ Add/adjust tests
→ Run relevant tests
→ Manual smoke when UI is touched
→ Compare against Done / Acceptance checklist
→ Fix every discovered debt in current Session
→ Write handoff
→ STOP
```

明确禁止：

```text
“主体完成，细节下一轮”
“接口已存在所以算完成”
“静态合同 PASS 所以浏览器链路默认 PASS”
Handoff 隐藏未完成
未过 Acceptance 进入下一 Session
留下双路径 / fallback 真相源
```

这一次 GUI 现场大量问题，恰好逐条违反这里：

- Core text edit API 有 → Web 没接 → 仍旧 fork confirm；
- ObjectOrbit 有 → Selection Strip 没退；
- Project same-tab open 有 → 默认仍 new-tab；
- OverlayStack 有 → 多数 popup 不消费；
- SpatialCanvas shared 有 → Context/Workflow 多选仍不共享。

所以这不是“E2E 没测到”。

> **是施工 SOP 没持续执行。**

---

# 3. 最关键原稿：三 Surface / Component 真正应该是什么

## `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

状态更新（2026-09-01 W0-2）：

```text
历史状态 = RAW_SOURCE_LOST / CACHE EVICTED
当前状态 = RAW_SOURCE_RECOVERED_EXTERNAL / LOCAL_VENDOR_PENDING
```

File Library 已重新定位到 exact-name file object，因此不得继续把它描述成“永久丢失”。但当前施工 runtime 不能把 File Library object 的 exact bytes 直接挂载进本 RC；在 repo-local exact vendoring + FULL READ 完成以前，`RECONSTRUCTED_AUTHORITY` safety net 继续有效，且禁止用 excerpt/snippet 拼出伪原稿。

它是 8/21 当时的重要**施工汇总主稿**，但不是三 Surface 产品定义的唯一创世来源，也不是后续 Freeze 的唯一 authority。当前不得把它作为永久施工 blocker；其权威内容仍按 `LOST_SOURCE_PROVENANCE_LEDGER_20260831.md` 由上游专题稿、后续 explicit Freeze、差分审计、当前源码/测试与最新用户裁决交叉验证。

历史上它曾是 Context / Workflow GUI 修复的**第一施工回源入口之一**。

原文冻结：

```text
Main = 自由画布
Context = 自由画布
Workflow = 自由画布
```

三者都拥有：

- Pan
- Zoom
- Select
- Marquee
- Move
- Resize
- Drop
- Fence
- Region
- Workbench
- Review
- Lens
- Presentation persistence

并且明确：

> 三大视图统一操作手感，不需要重写 Canvas。

现有代码地基当时已经被确认：

```text
SpatialCanvas
gesture controller
dropStrategyRegistry
camera
selection
marquee
Project View Drop
presentationDraftState
SurfaceObject identity
```

施工顺序也写死：

```text
S0 共用地基
→ Main
→ Context components
→ Workflow components
→ X1 跨视图统一
```

---

# 4. 问题索引 A｜三 Surface 基础交互没有统一

## 当前问题

- Context 多选不可用
- Workflow 多选不可用
- Orbit 只有 Main/Glyth 有
- Reference / Composer / Right-click / Pin 在 Context / Workflow 缺失
- resize / relation / focus 各 Surface 行为不一致

## 原文

`LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

明确：

> Main / Context / Workflow 都建立在同一 SpatialCanvas / Selection / Drag / Drop / Resize 等底座。

以及：

> Shared Engine ≠ 单画布三模式；共用的是操作原语，不是 Surface identity。

`LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`

Pass A 甚至逐项写：

- pan
- zoom
- drag
- resize
- multi-select
- drop
- fence
- projection identity

## 当前偏差

施工只“共享了 Canvas 组件”，没有真正共享完整 Interaction Controller。

## 修复类型

**REWIRE / ARCHITECTURE P0**

建立：

`SpatialInteractionKernel`

Main / Context / Workflow 只做 adapter。

---

# 5. 问题索引 B｜Structure / Evolution / Relationship 又变成 Card / View

## 当前问题

- Context 里 Structure / Evolution / Relationship 是大白卡
- double-click 又弹大窗口
- resize 是 generic card resize
- 看不懂怎么编辑/引用
- Structure Mind Map 缩在大白框中央
- Evolution 不是 timeline strip
- Relationship 不是局部 relation field

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

逐字冻结：

> Structure / Evolution / Relationship 不再是 Context 的三个页面。

它们应该成为：

> 可以放进 Context 画布、移动、缩放、并排比较、绑定对象的“理解组件”。

原文形态：

### Structure Map
> 不是树页面；是可缩放结构岛：核心对象 + 分支灯条 + 节点。

### Evolution Strip / Field
> 可横向时间带，也可空间化“阶段轨迹”。

### Relationship Field
> 不做整屏 Graph；局部关系场，选中对象后展开周边。

并明确：

> Structure = 同一 Project Truth 的结构透镜。  
> Evolution = 同一 Project Truth 的时间透镜。

### `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_...`

明确旧页面迁移：

```text
ContextTreeSurface
→ Structure Map renderer / Lens

ContextFlowSurface
→ Relationship / Flow renderer

ContextRelationshipHomeSurface
→ Relationship Field renderer

Timeline / history
→ Evolution data adapter
```

## 当前偏差

我们只完成了：

> “页面降级成了组件数据结构”

但 presentation 仍是：

> “把旧页面缩进一张 generic SurfaceFrame 白卡”。

## 修复类型

**REBUILD PRESENTATION，不改 Truth**

---

# 6. 问题索引 C｜Context Lens / 现场结构演进“眼镜”没正确退役

## 当前问题

- 现场 / 结构 / 演进仍像第二套 mode
- 用户被赶出自由 Context 桌面
- lens 与 component 混淆

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

Context Lens 明确：

> 临时把结构/关系/演进放大查看。  
> 组件的“放大阅读模式”，不是第四张桌子。

### `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_...`

明确：

```text
放大 ≠ 新主页面
```

Lens：
- 居中
- 临时
- Esc 退出
- 保持原组件位置
- 不生成 duplicate

## 当前偏差

Lens 能力和 Surface mode UI 没彻底分离。

## 应保留

- Camera Focus
- Focus framing
- overview → target travel
- temporary reading state

## 应退役

独立的“眼镜 mode system”。

## 修复类型

**RETIRE UI / REUSE CAMERA**

---

# 7. 问题索引 D｜Workflow 被做成“操作间 / 流程搭建器”

## 当前问题

- 顶部大量 Step / Arrange / Save Skill / Skill / Export / Import
- 创建 Step 直接出现 form
- Active Path 变成独立组件
- Workflow 看起来像低代码 builder
- 已连线的 path 还需要另外摆一个 Active Path component
- Scope 不存在或被错误节点化

## 原文

### `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`

明确：

> Workflow 不是自动化流程搭建器。

禁止：

```text
用户逐步拖步骤
→ 填参数
→ 配 MCP
→ 配 CLI
→ 在 LCOS 内搭自动化 DAG
```

0.15 Workflow：

```text
必要上下文
+ 当前目标
+ 动作/意图
+ 可用 Skill/能力
→ Agent/API
→ Return
```

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

Workflow 第一性：

> 行动现场。

> 它不是 BPMN，也不是流程图软件。它仍是一张自由桌面。

### `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_...`

Definition of Done：

- Step 可自由摆
- Active Path 明确
- Review / ChangeSet 可用
- Prompt Workbench 可复用
- Graph 只是 Lens

## 当前偏差

代码实现把“Workflow 数据模型可编辑”错误翻译成：

> “把所有 workflow operation 做成顶部操作栏”。

## 修复类型

**RETIRE OPERATION-ROOM CHROME**

---

# 8. 问题索引 E｜Scope 丢失 / 节点化

## 当前问题

用户预期：

> Scope 是可装配的 Workflow Component。

当前：
- Scope 不是明确组件
- 或被抽象成 representation-only node / status
- 没有清晰装配入口

## 原文脉络

8/21 主稿的 component philosophy 已明确：

> Surface 中理解/行动层抽象应该成为可 Move / Resize / Bind / Drop 的 Component，而不是再开页面。

最新冻结进一步确认：

Scope = Workflow Component / Field / Lens。

## 修复

Scope：

```text
当前 Workflow 的作用范围
绑定对象
装配材料
执行范围
```

它应该：
- Move
- Resize
- Drop
- Assembly
- Focus
- Edit

不应该：
- 是空白 proxy node
- 是 operation panel
- 是表单

## 修复类型

**RESTORE MISSING COMPONENT**

---

# 9. 问题索引 F｜组件本来应该可装配，Assembly 却跑成独立管理页

## 当前问题

- Main/Context/Workflow 对象旁边找不到 Assembly
- Assembly 只能从 Project Home/Capture 进入
- 进去后像左 Target 列表 + 右库存管理器
- 用户已经选对象还要再选 Target
- Context/Workflow Component 不知道在哪里装材料

## 原文

### `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`

Assembly：

> 整个 Project 共享的仓库/装配工作壳。

入口：

```text
Main
Context
Workflow
Glyth / Conversation
```

区别：

> 只在 Target。

交互：

> 即拖即用 / 即点即用 / 即插即用。

明确禁止：

```text
Drop
→ 选择操作
→ 选择模式
→ 选择 Target
→ 填表
```

### `LCOS_v0.15_RC973ca91_GitHub差异审计与漏网能力盘点_20260829.md`

已在当时发现：

`applyAssembly()` Web usage = 0

并列为 P0：

> 所有来源 commit 最终统一收敛 canonical applyAssembly。

## 当前偏差

Assembly contract 有了，但对象现场入口和 spatial presentation 没真正落。

## 修复类型

**REWIRE + PRESENTATION REBUILD**

---

# 10. 问题索引 G｜Skill Builder 原文明确是“文本大纲 + 思维导图直接操控”，现在却是卡片/流程列表

## 当前问题

- `技能 · SKILL.md` 打开后是列表/详情 card
- Step workflow 被错误显示成 Skill 内容
- “重放”“定位编辑”像流程管理器
- 不像 Skill package 编辑
- Root/Subskill Mind Map 心智消失

## 原文

### `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md`

原文非常明确：

Workflow Skill Builder：

> 不是普通 Markdown 编辑器，也不是代码配置页，而是 Skill Artifact 的强编辑投影。

**必须复用：**

- Text Outline
- Mind Map
- Direct Manipulation
- Drag / Drop
- Reorder
- Selection
- Multi-selection
- Semantic Drop
- Proposal / Preview / Keep-Revert

编辑对象：

- Root Skill
- Subskill
- Resource module
- Trigger / Scope
- Router / Index
- Execution module
- Validation / Eval module

并明确：

> 正常 GUI 不以逐字修改 SKILL.md 为主。

Root / Subskill：

> 每个 Subskill 是完整、可独立复用的 Skill package。

支持：
- 独立拖入 Workflow
- 独立 Reference
- 重命名
- 颜色身份
- 替换
- 复制
- 禁用
- 拆为独立 Skill

## 当前偏差

底层 Skill package / composition 做了，
但 GUI 又退成“workflow recipe list”。

## 修复类型

**RESTORE ORIGINAL SKILL BUILDER UX**

---

# 11. 问题索引 H｜Prompt Workbench / Composer 被做成大配置面板

## 当前问题

- Selection 自动变 Reference
- 单击又开 Composer
- current selection / durable material / runtime / version 同时曝光
- Reference 不是显式挑选
- Glyth/Context/Workflow 各有不同入口

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

Prompt Workbench：

> 中型工作台，可接受 Drop；状态灯条 + 插槽。

### `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_...`

Workbench Frame：

```text
ReferenceSlots
PromptEditor
RunControl
OutputPreview
```

Workbench 是少数明确可接收 Drop 的组件。

并且整个工作台仍属于自由 Surface，而不是全局执行配置页。

### `LCOS_B_STAGE_CONVERGENCE_PATCH_REPORT_20260816.md`

明确：

> AI 是 LCOS 的能力，不是 LCOS 的界面。

> 临时 Composer 只有明确召唤才出现。

## 当前偏差

执行 contract 被原样搬成 GUI 字段。

## 修复类型

**PROGRESSIVE DISCLOSURE RESTORE**

---

# 12. 问题索引 I｜Text / Note 原文就不是复杂 Card

## 当前问题

- Text 大白框
- selected → full
- 远处巨大 geometry + tiny text
- 编辑又 portal 第二张 editor
- canonical text 能修改却弹 fork confirm

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

Text / Note：

> 极简文字块。

Reader：

> 临时深入阅读文档 / 摘录。  
> 中央临时阅读层，**不是永久节点**。

### 后续 Skill Builder 原文进一步确认：
LCOS 已成熟的 Text Outline / Mind Map / Direct Manipulation 应作为编辑基建。

## 当前偏差

Text renderer 有进步，但 Generic CanvasCard / portal editor / stale Core wiring 反向覆盖了原始 interaction。

## 修复类型

**GEOMETRY + SAME-FACE EDIT + WIRING**

---

# 13. 问题索引 J｜Representation-only Node 早就不该泛滥

## 当前问题

- 1111 这种 Step/Proxy node
- Scope/Path/Status 为“表示存在”而存在
- 对节点什么都干不了

## 原文

### `LCOS_ROADMAP_OPEN_SOURCE_LAUNCH_PLAN_20260814_v3.md`

Entity First 并不等于：

> 所有 Entity 都画成 Node。

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

大量判断明确：

- Collection / Cluster：不要另造组件，复用 Fence/Region
- Focus Locator：不是组件，是全局视觉行为
- Search Result Cluster：临时态，不做长期组件
- Reader：不是永久节点
- Context Lens：不是第四张桌子

也就是说，从一开始就是：

> **只有需要成为空间物体的东西才成为空间物体。**

## 修复类型

**NODE ADMISSION CENSUS + RETIRE**

---

# 14. 问题索引 K｜Drop 又退回“先选动作 / 再确认”

## 当前问题

- 承接点一次再确认
- Assembly 还要再选 target
- 旧 drop/menu 心智仍出现

## 原文

### `LCOS_ROADMAP_OPEN_SOURCE_LAUNCH_PLAN_20260814_v3.md`

Drop：

> “我想在这里使用它”。

不是：

> move / copy / reference 三选一。

### `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`

再次冻结：

> 即拖即用 / 即点即用 / 即插即用。

只有真实歧义或危险才询问。

## 修复类型

**DIRECT INTENT RESTORE**

---

# 15. 问题索引 L｜旧页面/旧 owner 应该“降级复用”，不是继续和新组件并存

## 当前问题

- Context Tree/Flow/Relationship old surface
- Lens UI
- Selection Strip
- new Orbit
- old dialogs
- new OverlayStack

新旧 owner 同时活。

## 原文

8/21 主稿反复使用的施工词其实是：

> **拆页面、提组件、统一 renderer、复用旧逻辑。**

旧 renderer：

> 先包 adapter，别先重写。

但目标是：

> 旧页面逻辑**迁入组件/Lens**。

不是：

> 新组件做一套，旧页面继续 production。

## 修复类型

**OWNER RETIREMENT**

---

# 16. 问题索引 M｜Camera / Focus 本来就是跨 Surface 公共能力

## 当前问题

- Context/Workflow double-click 弹 modal
- Focus 相机不能刚好框住对象
- Pin/Navigation camera 不统一

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

Focus Locator：

> 不是组件，是全局视觉行为。

Context Lens：

> 临时放大阅读。

### 主稿

已有 Focus / Camera / SpatialCanvas 基础应继续复用。

## 修复类型

**SHARED CAMERA FRAMING**

---

# 17. 问题索引 N｜Agent / Receiver 不应该改变 Surface interaction

## 当前问题

- 承接弹风险确认
- Glyth 操作与三 Surface 分裂
- Surface switch / receiver switch 存在 UI 重置风险

## 原文

### `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_...`

Receiver Acceptance 明确：

- 切换 Receiver 不改变三张工作现场
- 切换 Receiver 不清空 Selection
- 切换本身不自动执行任务

一句冻结：

> 聊天可以换，施工现场不换；Session 可以死，Project / Work Item / branch / Main / Context / Workflow 都继续存在。

## 修复类型

**RECEIVER UI LIGHTEN + NO SURFACE RESET**

---

# 18. 问题索引 O｜Visual Material 原文从来不是“统一白卡”

## 当前问题

- Component generic white card
- Artifact generic card shell
- ZIP/Text/Link 都像一种 node
- Control icon tiny
- resize generic edge

## 原文

### `LCOS_三大视图组件体系筛选表_v01_20260821.md`

原稿一直强调不同 Spatial Materials：

- Entity / Artifact
- Fence / Region
- Structure Map
- Evolution Strip
- Relationship Field
- Source Stack
- Workbench
- Step
- Path
- Review

不是一个：

> `SurfaceFrame + title + white background`

### `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`

明确提出：

> Material + Physics

每种材料有自己的 interaction physics。

## 修复类型

**SPECIES MORPHOLOGY RESTORE**

---

# 19. 问题索引 P｜Component Catalog 原来就不是为了凑数

8/21 原始筛选表已经大量写：

- 不另造组件
- 作为临时态
- 作为全局视觉行为
- 降级成 Lens
- 复用 Fence/Region
- Reader 不是永久节点

所以今天看到：

> Workflow Catalog 只有 Active Path 能用

以及：

> 为了“有一个组件”而创建 Active Path

说明 Catalog 筛选纪律丢了。

Catalog 的要求不是：

> 每个 Surface 有几个组件。

而是：

> **这个组件是否提供了不可由普通 Object/Relation/Field 完成的真实价值。**

---

# 20. 当前问题 → 第一回源文件速查表

| 当前问题 | 第一原文 |
|---|---|
| 三 Surface 多选 / Orbit / Resize 不统一 | `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_..._20260821.md` |
| Main/Context/Workflow 统一 Surface Engine | 同上 + `LCOS_Malleable_Spatial_Surface...20260821.md` |
| Context Structure / Evolution / Relationship | `LCOS_三大视图组件体系筛选表_v01_20260821.md` |
| Context Lens 不是新页面 | 同上 |
| Workflow 是自由行动桌面，不是低代码 | 同上 + `LCOS_v0.15_UX冻结_...Assembly_20260829.md` |
| Prompt Workbench | `LCOS_三大视图组件体系筛选表_v01_20260821.md` + 8/21 主稿 |
| Skill Builder = Outline + Mind Map | `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md` |
| Assembly project-level / target-only difference | `LCOS_v0.15_UX冻结_...Assembly_20260829.md` |
| Assembly apply/wiring P0 | `LCOS_v0.15_RC973ca91_GitHub差异审计与漏网能力盘点_20260829.md` |
| Drop = 在这里使用 | `LCOS_ROADMAP_OPEN_SOURCE_LAUNCH_PLAN_20260814_v3.md` |
| AI 不应变界面 | `LCOS_B_STAGE_CONVERGENCE_PATCH_REPORT_20260816.md` |
| Session Acceptance / 不许语义完成 | `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md` |
| Receiver 切换不改变 Surface | 8/21 v03 主稿 |
| Entity First ≠ 每个 Entity 都 Node | 8/14 Roadmap + 8/21 Component 筛选表 |
| Camera / Focus 是全局能力 | 8/21 Component 筛选表 |
| Visual Material / physics | `LCOS_Malleable_Spatial_Surface...20260821.md` |

---

# 21. 为什么会发生

从原始施工顺序反推，最可能的失败点是：

```text
S0 共用地基
C1-C7 Context
W1-W7 Workflow
X1 跨视图统一
```

在后续多 Session / 多 Patch 中被拆散。

施工者更多验证：

> “Context 能显示”
> “Workflow 能新增 Step”
> “Component 有 renderer”

而没有继续每包回读：

```text
Shared interaction preserved?
Component morphology still matches original?
Old owner retired?
Main/Context/Workflow cross-surface acceptance passed?
```

于是最后形成：

> **Vertical feature PASS，Horizontal product grammar FAIL。**

---

# 22. 现在不应该先跑 Full E2E

用户判断成立。

当前甚至不需要复杂 E2E 才能证明失败。

因为以下最基础的人手 10 分钟 smoke 已经会失败：

```text
Main:
select / multi-select / orbit / reference / pin / resize

Context:
重复同样动作

Workflow:
重复同样动作

Context:
create Structure / Evolution / Relationship
→ move / resize / focus / edit / reference

Workflow:
create Scope / Step / Path / Skill
→ move / resize / focus / edit / reference / assembly

Skill:
open Builder
→ Root/Subskill mind-map direct editing

Assembly:
from Main / Context / Workflow object open
→ target already correct
```

如果这些都不成立，Full E2E 只是在给错误的产品跑得更稳定。

---

# 23. 正确施工顺序重置

## Phase 0｜Original-source Lock

所有 Agent 开工前必须读：

1. `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
2. `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_..._20260821.md`
3. `LCOS_三大视图组件体系筛选表_v01_20260821.md`
4. `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`
5. `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`
6. `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md`

不是只读最新 Handoff。

---

## Phase 1｜Manual Product Conformance

先不写代码。

逐条实机标：

```text
PASS
REGRESSION
MISSING
WRONG OWNER
WRONG MORPHOLOGY
STALE UI
```

至少覆盖本文件 A–P。

---

## Phase 2｜Owner / Shared Kernel

先修：

- shared Selection / multi-select
- Orbit / right-click
- Reference / Composer
- Pin / Focus
- hit target
- resize
- relation
- camera
- overlay

三 Surface 全通。

---

## Phase 3｜Component Restoration

Context：

- Structure
- Evolution
- Relationship
- Source
- Context Pack

Workflow：

- Scope
- real Step
- Path
- Review
- Checkpoint
- Skill Builder

完全对照 8/21 原稿。

---

## Phase 4｜Assembly / Skill

恢复真正：

- object-local Assembly entry
- component Assembly
- shared warehouse
- Root/Subskill Mind Map

---

## Phase 5｜Visual / Motion

再用 Lovart / TapNow / Trae / Codex Desktop donor 做：

- progressive disclosure
- local controls
- geometry LOD
- camera framing
- causal motion

---

## Phase 6｜最后才 Full E2E

这时 E2E 才是在证明正确产品。

---

# 24. 新的施工强制检查

每个 GUI patch Handoff 增加：

```markdown
## Original-source conformance

Original file(s):
- ...

Original frozen rule:
- ...

What this patch changes:
- ...

What old owner is retired:
- ...

Main parity:
- PASS / N/A

Context parity:
- PASS / N/A

Workflow parity:
- PASS / N/A

Manual product smoke:
- ...

Any visual / interaction deviation from original:
- NONE / EXPLICITLY APPROVED
```

没有这一段：

> 不允许进入下一施工包。

---

# 25. 一句话

这次最需要修的不是某张卡。

是施工流程本身：

> **以后任何 Agent 不允许只读上一个 Agent 的 Handoff 就继续施工。涉及产品语义时，必须沿 Context Index 回到对应的原始冻结稿，再对照真实源码。**

否则每次压缩上下文，产品就会被“重新发明”一次。
