# LCOS v0.15 · 每次施工前强制阅读上下文
## Original Plan Fidelity + 2026-08-30/31 Reality Feedback + Construction Gate

日期：2026-08-31  
状态：**MANDATORY / AUTHORITATIVE PRE-CONSTRUCTION CONTEXT**

> 这份文件不是普通 Handoff。
>
> **任何 GPT / Codex / TRAE / 本地开发对话，在继续 LCOS v0.15 GUI / UX / Runtime / Assembly / Skill / Surface 施工前，必须先读完本文件。**
>
> 只读上一份 Handoff，不算恢复上下文。
>
> 只读最新施工计划，不算恢复产品。
>
> 只看当前代码能做什么，不算理解 LCOS。

---

# 0. 双 Gap 模型：以后永远同时检查两条线

LCOS 当前问题必须同时分成两类：

## A. PLAN FIDELITY GAP

定义：

> 用户/原始冻结稿已经明确说过，但后续施工计划遗漏、压缩、没有写成 Acceptance，导致施工者后面根本不知道要守什么。

典型：

- 8/21 三 Surface 完整 same-physics 没被 8/27 新权威计划逐条映射；
- Structure 的 move/resize/focus/source/Lens 动词被压成“有 Structure”；
- Context Component morphology 被压成 component type；
- Assembly 原始两阶段 spatial warehouse 心智被压成 split management shell；
- Final E2E 没验证 Skill Builder = Outline + Mind Map。

---

## B. REALITY / PRODUCT FEEDBACK GAP

定义：

> 即使原施工计划 100% 完成，真实 GUI 使用仍然暴露的新问题、细化和更高阶裁决。

这些不是“忘了原计划”。

它们是：

> **用户实机使用之后形成的新 L0 裁决。**

典型：

- hit target 不能跟 camera zoom 缩没；
- Orbit click-open 不能 pointerleave 自动消失；
- overlay 应在对象外空白画布展开；
- relation 发起入口应该从 Orbit 明确进入；
- Navigation + colored Pin HUD 双层定位；
- Camera Focus 应按 locate/read/edit framing，不是 raw bounds fit；
- control 11px/16px 在 Spatial Canvas 里太小；
- Project identity 应进入 Glaze 语言；
- remote Link / local HTML 应统一成 Web Artifact Host；
- OS-like File Artifact 不应再包 generic card。

以后任何施工必须检查：

```text
Original Plan Fidelity
+
Latest Reality Feedback
```

缺一不可。

---

# 1. 产品根哲学

必须保持：

```text
Project > Surface > Executor

Entity First
Surface Second
Executor Replaceable

One Project Truth

Entity First ≠ Node First
Surface Second ≠ Surface Same

Drop = 在这里使用
```

LCOS：

> Local-first、Agent-compatible 的 Spatial Project World / Project Continuity Layer。

不是：

- AI 白板；
- Workflow SaaS；
- low-code DAG builder；
- Agent dashboard；
- 卡片管理器。

---

# 2. 三 Surface 永久硬规则

Main / Context / Workflow：

> **同一套 Spatial Interaction Kernel，三个不同语义现场。**

基础操作必须完全同构：

- Click Selection
- Shift additive Selection
- Marquee/Lasso
- Ctrl/Cmd + Click Reference
- Move
- Resize
- Orbit
- Right-click
- Relation
- Pin
- Composer
- Reference Pick
- Semantic Drop
- Search
- Focus
- Camera Fit
- Esc/outside close
- Interaction LOD
- Hit Testing

任何基础交互：

```text
Main 有
Context 没有
```

或：

```text
Main 有
Workflow 没有
```

都直接判：

> **P0 Regression**

Surface 差异只能来自：

### Main
项目地形。

### Context
项目理解：
- Structure
- Evolution
- Relationship
- Source / Provenance
- Context-specific Lens / component editing

### Workflow
项目行动：
- Scope
- Action / Step truth
- Path
- Review / Checkpoint truth
- Skill Builder
- Workflow-specific assembly

---

# 3. Shared Spatial Interaction Grammar

## Rest

对象只是自己。

不显示：
- generic toolbar；
- generic card shell；
- metadata footer；
- runtime source；
- status panel。

---

## Click

```text
Click = Selection
```

仅：
- Selection Field；
- Object Orbit。

不自动：
- 打开 Composer；
- 添加 Reference；
- 展开 Detail。

---

## Shift + Click

```text
additive Selection
```

三个 Surface 完全同构。

---

## Ctrl/Cmd + Click

```text
this-run Reference
```

Selection ≠ Reference。

硬验收：

```text
Selection count != Reference count
```

---

## Body Drag

```text
Move / Semantic Drop
```

Drop 到哪：

> 就是在这里使用。

不再：
- Move/Copy/Reference 三选一；
- 先注册；
- 再填表；
- 再选 target。

---

## Relation

发起方：

```text
Select
→ Orbit
→ Relation
→ Orbit yields
→ Source connection port wakes
→ line follows pointer
```

接收方：

```text
approach target edge
→ receptive halo
→ absorb
→ relation settles
```

不要长期放一个难发现的 tiny notch。

Relation label 与 cut/scissors 不能共用 midpoint。

---

# 4. Hit Target / Interaction Bounds

当前实机反馈：

> Camera 拉远后对象视觉变小，hit area 也变小，最后点不到。

永久规则：

```text
Visual Bounds
≠
Interaction Bounds
≠
Semantic LOD
```

LOD 可以减少：
- detail；
- labels；
- handles。

但不能减少：
- entity identity；
- Selection ability；
- minimum screen-space hit target。

建议：

- Artifact：32–36px minimum hit target
- Glyth / Project Glaze：36–44px
- Orbit satellite：32–36px hit target
- Relation receptive edge：额外 12–18px halo
- Resize handle：10–14px hit target

Far LOD 仍必须可选。

---

# 5. Universal Object Orbit

当前 Conversation-only Orbit 必须升级：

> Universal Object Orbit。

Orbit 是：

> **对象的手。**

只放最直接、最高频 3–5 个动作。

### Artifact
- Open / Preview
- Relation
- Pin
- Assembly
- More

### Glyth
- Speak / Enter
- Relation
- Pin
- Set Current
- Assembly / More

### Context Component
- Focus / Edit
- Relation
- Pin
- Assembly
- More

### Workflow Component
- Edit
- Relation
- Pin
- Assembly
- More

不要把：
- status；
- runtime metadata；
- provenance；
- delete；
- diagnostics

塞 Orbit。

---

# 6. Right-click

Right-click：

> 通用、低频、管理类动作。

基础菜单：

- Open / Focus
- Pin / Unpin
- Add Reference
- Assembly
- Duplicate（若允许）
- Reveal / Source
- Remove Projection / Delete
- More

Pin 等高频动作允许同时存在于 Orbit 和 Right-click。

---

# 7. Composer

当前大执行配置面板必须退。

正确：

```text
Orbit → Speak
→ Orbit yields
→ Compact Composer opens on nearby blank canvas
```

首层只显示：

- receiver identity
- explicit references
- prompt
- send

二级：
- 当前任务必要参数。

三级：
- runtime
- provider
- provenance
- advanced
- durable context detail

不能默认曝光。

---

# 8. Reference Pick Mode

支持：

```text
Ctrl/Cmd + Click
```

快速 Reference。

或：

```text
Composer → Add Reference
→ Temporary Reference Pick Mode
```

Pick Mode：

- Composer 保持原位；
- 画布对象直接点击；
- reference strip 即时更新；
- Esc 退出 Pick Mode；
- Composer 仍然保留。

可以从：
- Canvas Object
- Pin HUD

直接选择 Reference。

---

# 9. Text

Text 不应是 generic card。

状态：

```text
RESTING
ACTIVE READING
INLINE EDITING
IMMERSIVE DETAIL
```

## Resting
可读预览。

## Click
Selection / Active Reading。

禁止：

```text
selected => full
```

Camera readability 优先。

## Editing
可见正文：

> same-face contentEditable。

不再用 portal 创建一张“假装覆盖原 node”的第二编辑器。

## Detail
只有：
- 内容超出；
- 长文；
- 用户明确 Detail

才进入 Immersive。

## Canonical edit
Core text revision API 已有。

普通 edit：

> 直接更新 canonical text revision。

“复制并编辑”只作为显式 Duplicate/Fork。

旧 blocking Confirm 正常路径退役。

---

# 10. Text Geometry LOD

当前问题：

```text
内容 LOD 变 compact
但 node.width / node.height 不变
→ 巨大空白矩形 + tiny text
```

永久规则：

> Content LOD + Visual Geometry LOD 必须一起变化。

Far：
- compact text identity。

Mid：
- title + heading / summary。

Near：
- readable body。

Edit：
- same face。

---

# 11. Generic CanvasCard / SurfaceFrame 退役

不能继续：

```text
Generic Card Physics
→ Species Renderer
```

正确：

```text
SpatialEntityFrame
→ identity / canonical position only

VisualSpecies
→ owns morphology / visual bounds

InteractionAffordances
→ capability-based

Selection Field
→ visual bounds
```

Glyth / Text / Link / File / Context Component / Workflow Component 不能继续拥有隐形 generic card 身体。

---

# 12. OS-like File Artifact

普通文件默认：

```text
system-like icon
filename
```

不是 LCOS card。

Import 与能力分开：

```text
importable
previewable
searchable
fragmentable
executable
externallyOpenable
```

不会解析 ≠ 不允许进入 Project。

---

# 13. Link Artifact

`.link.md`：

> internal persistence backing。

绝不能成为用户 identity。

Identity precedence：

```text
canonical artifact kind/sourceKind
>
resource semantic kind
>
MIME
>
extension
>
generic fallback
```

Link presentation：

### Compact
favicon + title。

### Rich
OG image + title + description + domain。

### Live
interactive web surface。

三者：

> 同一个 Link Artifact 的 Presentation。

---

# 14. HTML / Web Artifact

本地 HTML：

> HTML Artifact。

Canvas：
- HTML/system-like icon
- filename

Preview：
> interactive Web Artifact Preview。

需支持：
- JS；
- local CSS/assets；
- relative resource path；
- local host；
- safe sandbox。

Remote Link Live 与 local HTML：

> 共用 Universal Web Artifact Host。

0.15 不必做完整 SDK，但必须：
- import
- interactive preview
- local assets work
- restart works
- safe sandbox

---

# 15. Glyth

Glyth：

> 一级物种，不是 Conversation Card。

Visual bounds：
- shrink-wrap body；
- interaction hit slop独立；
- Selection Field围绕真实 body。

Orbit：
- click-open；
- 稳定存在。

关闭仅由：
- action；
- outside click；
- Esc；
- selection change；
- deeper viewer。

禁止 pointerleave 300ms 自动关。

---

# 16. Receiver / 承接

点击具体 receiver 的“承接”：

> 1 click 完成。

直接：
- current check；
- active state；
- panel settle。

不弹 blocking confirm card。

site mismatch / pending review：
- inline hint；
- non-blocking。

只有真正 destructive disconnect 才确认。

---

# 17. Navigation + Pin

两者互补。

## Navigation
大方向：
- Surface
- Workspace
- region
- Minimap
- edge cursor
- cross-surface direction

## Pin
精确书签：
- Artifact
- File
- Glyth
- Result
- Component

TapNow donor：

Top-center Pin HUD：

```text
● ● ●
```

颜色分组。

Hover：

```text
蓝色 · 4 个
```

Click：
列出同色节点。

点具体目标：

```text
Camera Focus
→ arrival beacon
```

不打开 Project Search。

普通可定位节点都可以 Pin，不限 Conversation。

---

# 18. Marker / HUD 尺度

当前 tiny control 反馈明确：

- 11px icon
- 16px marker
- 20px button

Spatial Canvas 中太小。

统一 screen-space token：

- primary control：30–34px visual
- hit target：36–40px
- secondary：24–28px
- icon：15–18px
- marker visual：22–24px
- marker hit：32–36px

Object body：
world-space。

HUD：
screen-space。

---

# 19. Camera Focus / Framing

现有 camera mechanism 可以复用。

新增：

```text
fitSpatialTarget()
```

模式：

### locate
target 占 viewport 35–50%。

### read
65–78%。

### edit
72–84%，给工具留空。

### overview
多对象 55–70%。

必须考虑 safe insets：
- Dock
- Rail
- Minimap
- top HUD
- open panel

center 是 safe canvas center，不是数学 viewport center。

---

# 20. Overlay

所有 contextual transient UI：

> 去对象旁边的空白 Canvas。

不是盖在对象上。

统一：

```text
SpatialOverlayPlacement
```

输入：
- target visual bounds
- overlay size
- viewport
- safe insets
- occupied overlay rects
- preferred side

输出：
> nearest free canvas rect。

一次只允许一个 dominant transient layer。

---

# 21. Context

Context 是自由理解现场。

不是数据库页。

不是 Context Cards 页。

共享 Main 所有基础 interaction。

只额外拥有理解组件。

---

# 22. Context Components

## Structure
不是白卡里的 tiny mindmap。

形态：
> structure island / branch map。

Rest：
摘要。

Focus：
camera fit + readable map。

Edit：
same-canvas。

---

## Evolution
不是大白卡。

形态：
> timeline strip / evolution track。

Rest：
轻时间条。

Hover：
point/label展开。

Focus：
轨迹展开到可读范围。

---

## Relationship
不是左右按钮表。

形态：
> local relation field / strands。

Rest：
主要关系。

Hover/Selected：
relation label展开。

Focus：
相关对象 + relation framing。

---

## Source
形态：
> provenance chain / source rail。

---

# 23. Context Lens

旧“现场/结构/演进眼镜”作为独立 mode：

> RETIRE。

保留底层：
- target locate
- camera fit
- focus framing
- arrival
- restore

交给：
- Pin
- Navigation
- Search Focus
- Component Focus
- Orbit Focus

调用。

---

# 24. Workflow

Workflow：

> 自由行动现场。

不是 operation room。

不是 Zapier/DAG builder。

主画布能做的一切基础交互：

> Workflow 必须全部拥有。

---

# 25. Scope

Scope：

> Workflow Component / Field / Lens。

不是 representation-only Scope Node。

表达：
- action scope
- included objects
- mounted materials
- execution range

支持：
- Move
- Resize
- Focus
- Edit
- Assembly
- Reference
- Pin

---

# 26. Active Path

如果真实 action / step 已通过 Relation / Path 连起来：

> path itself is truth。

不再生成一个：

```text
Active Path Node
```

代表“这里有一条 path”。

只有当 Component 提供额外：
- filtering
- analysis
- compare
- reorganize

才有资格存在。

---

# 27. Representation-only Proxy Node

永久禁止：

> 仅仅为了表示后端 Entity / Scope / Path / Status 存在，就创建一个 generic Node。

Node Admission Test：

至少满足其一：

1. 本体就是可感知内容；
2. 有独立空间身份和直接操作价值；
3. 用户真的需要 Move/Compose/Connect/Pin/Reference；
4. 有自己的 morphology。

否则：
- Component
- Field
- Relation
- Orbit action
- Inspector/Popover
- 或不显示。

---

# 28. Workflow Component

不要凑 Catalog 数量。

只保留真正提供不可替代工作价值的 Component。

Surface Component：

> 宁缺勿滥。

---

# 29. Skill

Skill：

> 一等 Project Artifact。

canonical truth：
> portable Skill package。

Workflow Skill Builder：
> editable projection。

不是第二份 Skill truth。

---

# 30. Skill Builder

必须恢复原冻结：

```text
Text Outline
+
Mind Map
+
Direct Manipulation
```

编辑：

- Root Skill
- Subskill
- instructions
- references
- scripts
- assets
- trigger
- scope
- router/index
- execution
- eval

支持：
- Drag / Drop
- Reorder
- Rename
- Color
- Replace
- Selection
- Multi-selection
- Map↔Outline

不能默认变成：

```text
几步
几份材料
重放
定位编辑
```

这种 recipe list。

---

# 31. Assembly

一个 Project：

> 一个 Assembly。

所有 Surface / Object 可进入：

- Main
- Context
- Workflow
- Glyth
- Selection
- Orbit

入口已经明确 target。

所以：

```text
Orbit → Assembly
```

不再进去问：

> 装到哪里？

---

# 32. Assembly vs Reference

Reference：

> 轻动作，“这次带上它”。

Ctrl/Cmd+Click 即可。

Assembly：

> 大动作，“长期/正式装到 target”。

用于：
- durable Glyth context
- Workflow Skill
- Context Source
- large multi-object configuration
- semantic composition

不要把轻 Reference 强迫进入 Assembly。

---

# 33. Assembly Presentation

Assembly 不是 SaaS Inventory panel。

应保留 project-level spatial warehouse 心智。

最终形态必须重新对照原始两阶段设计和最新用户 L0 裁决，不可直接把当前左 list / 右 source bay 当最终形态。

---

# 34. Project Navigation

普通 Project 点击：

> same-tab Project Continuity。

`openProject()` 是默认。

New Tab：
> explicit More action。

不能默认 launcher-new-tab。

---

# 35. Project identity

旧 generic geometric `ProjectGlyphMark` 用户明确否决。

新方向：

> ProjectGlazeMark。

同一 Glaze organic material family。

但不复用 Conversation receiver/lifecycle semantics。

支持：
- seed shape
- tint
- manual scale
- optional orientation
- subtle idle morphology

---

# 36. Project / Glaze Resize

World body：
> 可直接用户 resize。

HUD：
> zoom independent。

Project Visual Profile Core 已允许更大 scale。

UI 不能只锁 0.82–1.16。

---

# 37. Relation UI Collision

relation label 和 cut control：

> 不能共享 midpoint。

cut：
line midpoint。

label：
沿 curve normal offset 18–24px。

Hover/select才显著。

---

# 38. Loading / Result Materialization

参考 Lovart / TapNow：

```text
intent
→ result footprint immediately appears
→ empty slot / skeleton
→ progressive fill
→ settle
```

不要：
- 全局 spinner；
- 内容突然从空气里出现；
- 空间位置跳动。

---

# 39. Motion / Interaction Grammar

Donor：
- Lovart
- TapNow
- Trae
- Codex Desktop

共同原则：

```text
Causal Continuity
Progressive Disclosure
Small Interaction Blast Radius
Content = Body
Controls = Satellites
```

一次动作只改变相关局部。

UI 必须能解释：
> 它从哪里来、为什么出现、下一步是什么。

---

# 40. Control Placement Hierarchy

## Object body
内容本体。

## Orbit
当前对象最直接的高频动作。

## Right-click
通用低频管理动作。

## Composer
prompt / reference / run-local execution。

## Pin HUD
精确快速导航 / 已知对象 palette。

## Assembly
大型 durable semantic composition。

## Dedicated Surface / Immersive
只有真正需要长期复杂编辑。

不能互相抢职责。

---

# 41. 每次施工前必须读的原始文件

至少：

1. `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
2. `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
3. `LCOS_三大视图组件体系筛选表_v01_20260821.md`
4. `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`
5. `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`
6. `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md`

然后读：

7. `LCOS_v015_原文到后续施工计划_差分审计_20260831.md`
8. **本文件**
9. `LCOS_v015_CONTEXT_TRACE_INDEX_20260830.md`
10. 当前真实 HEAD / source / tests / closeout。

## 41.1 原始文件永久丢失时

默认仍要求 FULL READ。

如果某个点名 raw source 已确认永久丢失 / cache evicted，不允许：

- 用搜索 snippet 冒充全文；
- 伪造原文；
- 因不存在的文件永久冻结施工。

改走：

```text
RAW_SOURCE_LOST
→ LOST_SOURCE_PROVENANCE_LEDGER
→ surviving upstream source
→ later explicit Freeze / L0 adjudication
→ delta audit
→ current source/test owner
→ latest user adjudication
→ RECONSTRUCTED_AUTHORITY
```

多源一致：允许继续。
多源冲突：`USER_ARBITRATION_REQUIRED / STOP`。
证据不足：`RECONSTRUCTION_INSUFFICIENT / STOP`。

当前 2026-08-21 v0.3 三 Surface 施工总稿已经按 2026-08-31 用户最新裁决登记为：

```text
RAW_SOURCE_LOST / RECONSTRUCTED_AUTHORITY
NON-BLOCKING for A13
```

详见：

`docs/v015/convergence/LOST_SOURCE_PROVENANCE_LEDGER_20260831.md`

---

# 42. 每次施工强制 Source-Diff Gate

开工前必须填写：

```text
Original User/Freeze:
Latest Override:
Latest Reality Feedback:
Current Construction Clause:
Current Code Owner:
Current Product Entry:
```

判定只能：

```text
MATCH
PLAN_GAP
REALITY_GAP
EXPLICIT_OVERRIDE
IMPLEMENTATION_GAP
WRONG_OWNER
```

不得直接开始编码。

---

# 43. GUI Patch Handoff 强制模板

```markdown
## Original-source conformance

Original source:
Original frozen rule:

Latest explicit override:
Latest user reality feedback:

Current production owner:
Old owner being retired:

Main parity:
Context parity:
Workflow parity:

Manual smoke:
Visual smoke:

Any PLAN GAP found:
Any REALITY GAP found:

Acceptance:
Debt:
```

没有这一段：

> STOP，不准进入下一施工包。

---

# 44. Manual Product Smoke 先于 Full E2E

当前阶段先执行真人 10 分钟检查：

## Main / Context / Workflow
逐一：
- Click
- Shift multi-select
- marquee
- Ctrl/Cmd reference
- Orbit
- Right-click
- Pin
- Relation
- Move
- Resize
- Composer
- Semantic Drop
- Focus

## Context
- Structure
- Evolution
- Relationship
- Source
- Focus/Edit
- Reference
- Assembly

## Workflow
- Scope
- Path
- Skill
- Focus/Edit
- Reference
- Assembly

## Skill
- Outline
- Mind Map
- Root/Subskill editing

## Assembly
- 从三个 Surface / Object 直接进入
- target 正确
- direct use

基础 smoke 失败：

> 不进入 Full E2E。

---

# 45. Full E2E 的新职责

Full E2E 不是替代产品验收。

顺序：

```text
Original-source Conformance
→ Reality Feedback Conformance
→ Manual Product Smoke
→ Automated Browser E2E
→ Runtime/Provider E2E
→ Desktop/Native
→ Installer
```

只有这样，自动化才是在证明：

> 正确产品稳定工作。

不是：

> 错误产品稳定工作。

---

# 46. 永久禁止

- 只读上一份 Handoff 后施工；
- “唯一权威计划”不做 superseded-requirement mapping；
- 有 contract 就宣称产品完成；
- renderer 存在就宣称 GUI 完成；
- static gate 绿就跳过实机；
- 为了 Catalog 数量造 Component；
- 为了 Entity 存在造 Node；
- 为了配置能力造 Panel；
- 旧 owner 和新 owner 同时 production；
- 用户最新实机反馈不进入下一轮施工上下文。

---

# 47. 最终一句

> **LCOS 的施工上下文从现在开始必须同时包含“最初为什么这样设计”和“今天实际用起来哪里仍然不对”。**

原始计划保护产品灵魂。

最新实机反馈保护产品不会变成一件“完全忠于设计稿、但没人想用”的博物馆藏品。


---

# 48. Video Donor 原稿强制索引

涉及以下任一施工域：

- Selection / Orbit / Reference / Composer
- Overlay / Tooltip / Popover / Right-click
- Pin / Marker / Navigation
- Text Geometry LOD
- Camera Focus
- ResultSlot / Loading
- Context / Workflow Component presentation
- HUD / Glyph / Motion / Material

必须额外阅读：

`LCOS_v015_VIDEO_DONOR_原稿总索引与施工映射_20260831.md`

并按索引追到对应解析原稿：

1. `LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`
2. `LCOS_v015_Lovart_Composer_ReferencePick_补充拆解_20260831.md`
3. `LCOS_v015_CodexDesktop_局部锚点_PersistentPanel_交互拆解_20260831.md`

视频 donor 不是产品 taxonomy authority。

它们只负责：

- craft
- interaction hierarchy
- spatial causality
- progressive disclosure
- loading
- camera framing
- pin/glyph
- motion

LCOS 产品 Truth 仍以原始冻结稿 + 最新 L0 用户裁决为准。

施工 Handoff 必须记录：

```text
Relevant Video Donor
Parsed Source
Borrowed Behavior
LCOS Truth Preserved
Explicitly Not Copied
```
