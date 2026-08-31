# LCOS v0.15 · 原文 → 后续施工计划 差分审计
## 专查“原文已经谈清楚，但后续施工计划有没有记进去”

日期：2026-08-31  
审计目的：**把“实现没照计划做”与“施工计划自己漏了原文”彻底分开。**

---

# 0. 结论先行

这一轮不是从当前 GUI 倒推需求，而是按时间做四层差分：

```text
A. 用户讨论 / 原始冻结稿
↓
B. 8/21 详细施工主稿
↓
C. 8/27–8/29 后续总计划 / F6 / R3 计划
↓
D. R2/R3 closeout + 最终 Full E2E 施工包
```

第一轮抽取 **32 个可证据化命题**，分类结果：

| 分类 | 数量 | 含义 |
|---|---:|---|
| PLAN GAP / COMPRESSION | 10 | 原文有，但后续施工计划遗漏、压缩过头或没有写成 Acceptance |
| EXPLICIT OVERRIDE | 10 | 后续有明确新裁决覆盖旧设计，不应误算“忘了” |
| PLANNED BUT CURRENTLY LOST | 12 | 后续计划其实写了，当前产品仍不符合，属于实施/接线/owner retirement 回归 |

最重要的根因不是某一个按钮，而是：

> **8/27 的“唯一权威施工序列”没有把 8/21 最详细的 Spatial / Component 三份原稿纳入输入裁决链。**

8/27 的输入链列了：

- Design Grammar Baseline
- `LCOS v0.15 GUI 感知层重构与前端施工规划.md`
- `LCOS v0.15 UX 架构第二轮收口与施工清单.md`
- Apple / grok donor
- Runtime Truth Map
- Visual Audit

但没有列：

1. `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
2. `LCOS_三大视图组件体系筛选表_v01_20260821.md`
3. `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`

而 8/21 主稿恰好是把：

```text
组件叫什么
+
它长什么样
+
怎么移动/缩放/编辑
+
旧页面怎么降级
+
跨 Surface 怎么统一
+
每一步怎么验收
```

写得最细的一份。

8/27 以后大量文档记住了“名词”，但丢了“动词、物理和验收”。

这就是为什么最终会出现：

> Structure 还在，但变成 Card。  
> Skill Builder 还在，但入口落到 recipe/list。  
> SpatialCanvas 还在，但三个 Surface 的交互不再同构。

---

# 1. 时间线上的“上下文断点”

## 1.1 8/21 是完整的施工母线

8/21 主稿给出的施工顺序：

```text
S0 共用地基收口
→ M1-M4 Main
→ C1-C7 Context
→ W1-W7 Workflow
→ X1 跨视图统一
→ A1 Agent Surface Composer
→ R1 Active Receiver
```

并进一步拆成真正施工 STEP：

```text
STEP 1 Shared Foundation
STEP 2 Main
STEP 3 Context Entry
STEP 4 Context Structure
STEP 5 Context Evolution
STEP 6 Context Relationship + Pack
STEP 7 Workflow Entry + Step
STEP 8 Workflow Path
STEP 9 Review + Checkpoint
STEP 10 Workbench
STEP 11 Agent Surface Composer
```

每包 Done 还要求：

```text
pan / zoom
drag
drop
identity
persistence
```

必须保持。

---

## 1.2 8/27 “唯一权威施工序列”发生第一次大压缩

8/27 改成：

```text
Wave A Foundation
Wave B Identity
Wave C Glyth
Wave D Spatial
Wave E Assembly
Wave F Skill / Safety
```

映射表只映射旧 Phase 1–7。

**没有把 8/21 的 S0 / M / C / W / X / A / R 序列逐项映射。**

于是原本独立的：

```text
Context Structure
Context Evolution
Context Relationship
Context Lens
Workflow Step
Workflow Path
Review
Checkpoint
Workbench
X1 Cross-Surface
```

没有作为等价施工包继续存在。

这是第一处真正的“计划漏单”。

---

## 1.3 8/28 F6 收口计划继续沿用缩窄后的上下文

8/28 F6A / F6B / F7 的“必读”主要指向：

- F6 GUI Freeze
- 视觉语言
- Unified Composer
- 后端 contract
- 8/26 GUI / UX 文档

依然没有把 8/21 三份最细 Spatial 原稿放回最高阅读链。

F7 的 Cross-Surface 只剩：

```text
same Entity:
selectable
editable
referenceable
identity unchanged
```

这比 8/21 的：

```text
Pan
Zoom
Select
Marquee
Move
Resize
Drop
...
```

窄了一大截。

---

## 1.4 8/29 用户纠偏后，部分内容被重新捞回

8/29 `F6 → R3` 主施工单重新明确：

```text
Same Physics, Different Semantics
```

共同基础重新写回：

```text
SpatialCanvas
Selection
Move / Resize
Orbit
Semantic Drop
Unified Composer
Glyth
Colony
Focus / Marker / Beacon
History / Preview / Commit
```

R2-D 又进一步冻结了真实鼠标语言：

```text
Click = Selection
Shift + Click = Multi-selection
Ctrl/Cmd + Click = Reference
Drag body = Move / Semantic Drop
Drag boundary notch = Relation
Middle Mouse Drag = Pan
Wheel / Pinch = Zoom / Semantic LOD
```

说明：

> **“三视图共用交互”最终计划并没有彻底忘掉，它在 8/29 被重新捞回来。**

所以今天 Context / Workflow 多选、Orbit 等不通，应该定性为：

> **计划后来重新写回了，但生产路径没有真正吃进去。**

---

# 2. PLAN GAP / COMPRESSION · 真正的施工计划缺漏 10 条

## GAP-01｜8/21 三份核心 Spatial 原稿从 8/27 权威输入链消失

### 原文
8/21 主稿明确声明自己是：

> 当前 GUI / Spatial Surface 施工主稿。

### 后续计划
8/27 “唯一权威施工序列”的输入链没有列这份主稿及其两个主要上游。

### 后果
后续计划没有逐项继承它的 C/W/X 施工语义。

**置信度：HIGH**

---

## GAP-02｜8/21 的 C1-C7 / W1-W7 / X1 没有被 8/27 映射

### 原文
独立施工：

```text
C1-C7 Context
W1-W7 Workflow
X1 Cross-Surface
```

### 8/27
只映射“旧 Phase 1–7”，没有映射这条 8/21 主线。

### 后果
后续施工更多按：

```text
功能块
视觉块
Glyth
Assembly
Skill
```

推进，而不是继续按三个 Surface 的完整语义闭环推进。

**置信度：HIGH**

---

## GAP-03｜“完整 Cross-Surface Physics Acceptance”一度被压成“多选共享场”

### 原文
三 Surface 都必须共享：

```text
Pan / Zoom / Select / Marquee / Move / Resize / Drop
```

### 8/27
映射表最显式只保留：

```text
P1 多选共享场 → Wave D-3
```

### 8/28 F7
又压成：

```text
可选 / 可编辑 / 可引用 / identity 不变
```

直到 8/29 才重新捞回 Same Physics 完整列表。

### 后果
8/27–8/28 是明显的计划信息损失窗口。

**置信度：HIGH**

---

## GAP-04｜Structure 的“动词”从施工计划里掉了

### 8/21 STEP 4
明确：

```text
Structure Map
reuse old tree data
move / resize
focus / source
Structure Lens
```

### 8/29 R3-C task boundary
主要写：

```text
Versions/Evolution
Structure
Relationship
Source
```

但没有重新列出 Structure：

```text
move / resize / focus / source / lens
```

的 Acceptance。

### 后果
“Structure 组件存在”可以通过静态 gate，
但“Structure 真正像一个可操控空间组件”不在对应 gate 的核心检查里。

这非常接近现在的白卡问题。

**置信度：HIGH**

---

## GAP-05｜Component Morphology 被从“物种+物理”压缩成“类型名+truth contract”

### 8/21
不仅说有 Structure / Evolution / Relationship。

还明确不同 Spatial Material 有自己的：

```text
morphology
interaction physics
information density
visual role
```

例如：
- Structure = 结构岛
- Evolution = 时间带 / 轨迹
- Relationship = 局部关系场

### R3-C
大量验收集中在：

```text
truth
projection
snapshot
revision
drag/reorder
contract
```

但没有逐物种恢复上述 morphology acceptance。

### 后果
renderer 能存在，却很容易统一掉进：

```text
generic SurfaceFrame
```

**置信度：HIGH**

---

## GAP-06｜Context Lens 的完整产品语义没有继续成为一等验收项

### 8/21
Lens 明确：

```text
temporary
centered
Esc exit
keeps source component position
no duplicate
```

Structure / Evolution / Relationship 都可以通过 Lens 深读。

### 后续
R3-C 重心变成 Evolution Workspace / Snapshot / Constellation，
没有把三个 Context Component 的统一 Lens 语义完整保留下来。

### 后果
容易重新出现：

```text
double click
→ another big page/modal
```

而不是：

```text
same component
→ temporary reading projection
```

**置信度：HIGH**

---

## GAP-07｜Assembly“第一屏总览 → 第二屏装配”的两阶段心智被压掉

### 8/26 原文
Assembly：

```text
第一屏 = 全项目 Warehouse 总览
每类是空间岛 / 小浮标

选择类别 / 开始装配
↓

第二屏 = Target Scene + Warehouse 左右分屏
```

### 8/28 F6A
直接定义：

```text
Assembly Workspace
Target Scene | Source Bay
```

### 8/29
继续主要用：

```text
Target + Source Bay
```

### 后果
“先逛仓库，再进入具体装配”的 spatial overview 心智消失，
Assembly 很容易直接长成管理页/库存页。

**置信度：MEDIUM-HIGH**
> 后续确有新冻结，因此此项需以用户当时原始对话为最终裁决；但从文档差分看，它确实没有被完整继承。

---

## GAP-08｜Assembly 入口矩阵被压缩

### 8/26
明确入口：

```text
底部 +
Glyth Orbit
Context
Workflow
Selection
Rail
```

入口只决定：

```text
target
preset filter
```

### 后续
F6A 重点写 Assembly 页面本体；
R3-D 后面补了 Composer / capability launcher 到 Assembly，
但没有继续把上述完整入口矩阵作为一个 Acceptance Matrix。

### 后果
今天出现：

> 在 Context / Workflow 的对象现场不知道怎么进入 Assembly。

非常符合这个漏单方式。

**置信度：HIGH**

---

## GAP-09｜Skill Builder 的 UX Acceptance 从最终收口计划里消失

### 8/30 Skill Freeze
明确：

```text
Text Outline
Mind Map
Direct Manipulation
Drag / Drop
Reorder
Selection
Multi-selection
```

以及：

```text
Root / Subskill
Rename / Color / Reorder / Replace
map ↔ outline transition
```

R3-D 施工 patch 甚至有专门 gate：

- whole Subskill object
- draggable reorder
- identity edit
- native spine/branch morphology

### 但最终 Full E2E 施工包
进入最终 convergence 后明确：

> 不在 final convergence 阶段重设计 UI。

Golden Path 对 Skill 只要求：

```text
Skill visible in Builder/Catalog
→ reuse Skill
```

没有验：

```text
打开的到底是不是正确 Skill Builder
是不是 Outline + Mind Map
是不是 direct manipulation
```

### 后果
一个旧 recipe/list panel 只要“能看到 Skill”，Final E2E 也可能绿。

**置信度：VERY HIGH**

---

## GAP-10｜最终 Full E2E 没继承 8/21 的组件级 Human Golden

### 8/21
Workflow E2E 直接要求：

```text
Step free drag
Material -> Step
Active Path
Checkpoint
Review
Keep
Revert
Workbench
Artifact output
```

Context 也有：

```text
Structure
Evolution bind/open source
Relationship seed/Lens
Context Pack
```

后来部分组件被新裁决退役，这没问题。

问题在于：

> 新组件集没有重新生成等价的“用户手势级 Human Golden”。

Final E2E 更多验证：
- truth
- runtime
- persistence
- provider
- installer

而 GUI 只作为粗粒度“能进入 / 能看到”。

### 后果
功能全绿，产品交互仍可以明显不对。

**置信度：HIGH**

---

# 3. EXPLICIT OVERRIDE · 这些不是“忘记”，是后来明确改了 10 条

以下不能拿 8/21 原稿直接要求恢复，否则会把真正的新裁决一起倒车。

## OVERRIDE-01
`Context Pack` → 8/29 明确退役。

## OVERRIDE-02
`Workflow Step` → Action adapter，隐藏，不进 Shelf。

## OVERRIDE-03
`Review Component` → native Review projection。

## OVERRIDE-04
`Checkpoint Component` → Context Version / Snapshot identity。

## OVERRIDE-05
generic `Workbench` → 退役；只有真实 Dedicated Workspace 才保留。

## OVERRIDE-06
Workflow Graph / automation DAG → 明确不做主工作方式。

## OVERRIDE-07
Fence / Region → canonical Colony / Field。

## OVERRIDE-08
Portal Component → Spatial Navigation entry。

## OVERRIDE-09
Workflow 专属 Catalog 从多个组件收敛成 `Action Path` 为主。

## OVERRIDE-10
Component 不作为 Assembly Source；
Assembly 管 Project / Capture / Sources / Skills，
Component 是 Surface Instrument。

> 注意：**Skill 是 Project Artifact，所以 Skill 可以进 Assembly。**
> 这和“Surface Component 不进 Assembly”不是一回事。

这些属于产品继续演进，不应该被“原文回滚”覆盖。

---

# 4. PLANNED BUT CURRENTLY LOST · 计划写了，但当前现场仍不对 12 条

这部分最关键，因为它证明：

> 不是所有问题都能怪计划。

## LOST-01｜Same Physics
8/29 主施工单已经明确：

```text
SpatialCanvas
Selection
Move / Resize
Orbit
Semantic Drop
Unified Composer
...
```

三 Surface 共用。

当前 Context / Workflow 不一致：

**实施/接线回归。**

---

## LOST-02｜Shift Multi-selection
R2-D 已明确：

```text
Shift + Click = Multi-selection
```

并声称 Main / Context / Workflow 共用 helper。

当前不通：

**production path / host wiring 回归。**

---

## LOST-03｜Ctrl/Cmd Reference ≠ Selection
R2-D 明确：

```text
Selection ≠ Reference Pick
```

F6B 也要求 Reference Pick 不破坏普通 Selection。

当前选中自动塞 Reference：

**实现倒退。**

---

## LOST-04｜Object body drag / semantic drop
R2-D 已明确：

```text
drag body = Move / Semantic Drop
```

各 Surface 不同：

**实现倒退。**

---

## LOST-05｜Relation notch
R2-D 明确：

```text
drag boundary notch = explicit Relation
```

如果当前仍只有小点/难命中：

**计划已有，GUI hit-area 没真正收口。**

---

## LOST-06｜Orbit 是共享空间物理
8/29 Same Physics 明确 Orbit 属三 Surface 共同基础。
8/27 B-6 甚至写：

> 单对象 click → Select + Orbit。

当前普通对象/Context/Workflow 缺 Orbit：

**实现覆盖不完整。**

---

## LOST-07｜Constellation 多选 / drag
R3-C Visual acceptance 明确：

```text
Constellation supports real selection / drag / multi-select
```

如果当前 Relationship/Context component 做不到：

**实现/入口错。**

---

## LOST-08｜Evolution direct manipulation
R3-C 明确：

```text
Track direct manipulation has visible local feedback
```

并 gate：
- reorder
- stretch
- fork
- dragging

如果现在只是看：

**实现/旧 renderer 路由错。**

---

## LOST-09｜No generic white-card ownership
R3-C Visual acceptance 明确：

```text
no generic white-card ownership returns
```

R3-B 也明确 Layout Instrument：

> not another family of card nodes.

当前 Context Component 仍是白卡：

**不是计划忘了，是 owner 没退干净。**

---

## LOST-10｜Assembly from any surface
8/26 Human Experience Test 明确：

```text
用户从任何现场进入 Assembly
→ 找到全项目对象
→ 看懂目标
→ 拖过去就是用
→ 退出原位置/血统不丢
```

当前做不到：

**页面入口/Return wiring 不完整。**

---

## LOST-11｜Skill Builder 本体其实已经做过专门施工计划

R3-D Freeze + patch 明确有：

```text
Root/Subskill
draggable reorder
identity edit
Skill Spine/Branch morphology
canonical callbacks
```

因此用户现在看到的：

```text
步骤
材料
重放
定位编辑
```

更像是：

> **旧 Workflow recipe / Skill panel 仍是 production entry，真正 Builder 没成为默认 owner。**

这不是 R3-D 计划没写，而是入口/owner 错。

---

## LOST-12｜Final plan 本来就知道“当前根文档会带偏”

最终 Full E2E 文档自己写：

> 当前 RC 存在“代码新、根文档旧”的上下文 GAP。

但它解决方法主要是：
- 更新 CODEX_START_HERE
- 做 canonical truth
- Full E2E

没有追加：

> **Original Product UX Conformance Gate**

所以它识别了“上下文问题”，却只从工程 provenance 层处理，没有从产品原文层处理。

这是为什么我们现在仍然需要本审计。

---

# 5. 最大的三个“事故点”

## 事故点 A｜8/27 权威计划漏掉 8/21 原著

这是最早的断点。

8/27 计划自称：

> 唯一权威施工序列

但它的“原著”列表没有 8/21 最详细施工主稿。

从这里开始，上下文就已经缩水。

---

## 事故点 B｜8/29 虽然把名词捞回来，却没有全部把“动作验收”捞回来

8/29 非常重要，它纠回了：

```text
Same Physics
Component 宁缺勿滥
Colony
Action Path
Structure / Evolution / Relationship / Source
```

但很多原来写在 8/21 STEP 里的：

```text
move
resize
focus
source
lens
same-face interaction
old owner retirement
```

没有逐组件重建 Acceptance Matrix。

于是：

> 名字回来了，物种行为没完全回来。

---

## 事故点 C｜最终 E2E 太工程，太少“产品物种验证”

最终计划非常强于：

- canonical truth
- restart
- SSE
- provider
- Skill writer
- CAS
- migration
- installer

但对 GUI 最危险的问题：

```text
我现在看到的到底是不是正确 owner？
这个组件是不是正确 morphology？
这个入口是不是正确主入口？
三个 Surface 手感是不是一样？
```

没有成为 Release Blocking Matrix。

所以“测试绿”完全可能和“产品明显错”同时成立。

---

# 6. 这次真正应该补的不是又一份普通施工计划

现在需要给现有施工计划加一个 **SOURCE-DIFF GATE**。

每一个产品命题，施工前必须有：

```text
ORIGINAL USER / FREEZE
↓
LATEST OVERRIDE?
↓
CURRENT PLAN CLAUSE
↓
CURRENT CODE OWNER
↓
CURRENT PRODUCT ENTRY
```

结果只能是：

```text
MATCH
PLAN_GAP
EXPLICIT_OVERRIDE
IMPLEMENTATION_GAP
WRONG_OWNER
```

不能再只写：

```text
contract exists
renderer exists
gate PASS
```

---

# 7. 建议马上使用的“原文差分表”格式

| ID | 原始裁决 | 原始文件 | 后续最新裁决 | 后续施工计划是否明确记录 | 当前 owner | 判定 |
|---|---|---|---|---|---|---|
| SPATIAL-01 | 三 Surface same physics | 8/21 Master | 8/29 Same Physics | YES | shared host / surface | IMPLEMENTATION_GAP |
| CONTEXT-01 | Structure move/resize/focus/source/Lens | 8/21 STEP4 | 未被明确覆盖 | PARTIAL | Context renderer | PLAN_COMPRESSION |
| SKILL-01 | Builder = Outline+MindMap | 8/30 Skill Freeze | 未覆盖 | R3D YES / Final E2E NO | Builder + old recipe panel | WRONG_OWNER + FINAL_PLAN_GAP |
| ASSEMBLY-01 | first overview → second split | 8/26 GUI | 8/29 Target+SourceBay | PARTIAL/CHANGED | Assembly shell | NEED ORIGINAL-CONVERSATION ARBITRATION |

---

# 8. 施工优先级因此也要改

不是先按“当前 bug 数量”修。

应该：

## P0-A｜先修 PLAN GAP

把缺掉的原文语义重新写进当前 authoritative construction plan。

否则修完下一轮又会掉。

重点：

1. Source chain 加回 8/21 三份原稿。
2. 为 Context / Workflow Component 建 action-level Acceptance。
3. Assembly 恢复入口矩阵和 overview/split 裁决。
4. Final E2E 增加 Skill Builder / Component morphology / Same Physics Human Gate。

---

## P0-B｜再修 WRONG OWNER

典型：

```text
真正 Skill Builder 已有
但 old recipe list 是默认入口

真正 Orbit 已有
但普通对象没走它

真正 shared interaction helper 已有
但 Context/Workflow production host 没吃

新 component renderer 有
但 generic SurfaceFrame 仍掌握视觉 owner
```

这类不要重写能力。

直接 retirement / rewiring。

---

## P0-C｜最后才补真正缺失实现

只有：

```text
原文有
计划有
正确 owner 已选
但代码真不存在
```

才属于“开发新东西”。

目前看来，比例比我们最开始想的低。

---

# 9. 当前最重要的新施工纪律

以后不能：

```text
上一份 Handoff
→ 下一份施工计划
→ 下一轮 Agent
```

必须：

```text
原始用户裁决
+ 原始冻结稿
+ 最新明确 override
↓
生成当前计划
↓
做 source-diff
↓
确认没有丢语义
↓
才能施工
```

尤其任何写着：

> “取代旧计划 / 唯一权威施工序列 / 最终收口”

的文档，必须附：

```text
Superseded Requirement Mapping
```

逐条说明：

```text
旧要求
→ 保留在哪
→ 被什么覆盖
→ 为什么废止
```

没有 mapping，不允许自称“全部吸收”。

---

# 10. 当前结论

用户的判断基本成立，但要再精确一层：

> **不是“计划完全没写，所以施工者随便做了”。**

真实情况是三种混在一起：

```text
一部分：
原文 → 后续计划真的漏了

一部分：
原文 → 后续有明确新裁决覆盖

还有相当大一部分：
原文 → 后续计划重新写回了
→ 实施/入口/owner 又没真正吃进去
```

最大的事故发生在：

> **8/27 计划重构时，没有把 8/21 最详细的 Spatial / Component 施工母稿逐条映射进入新的权威计划。**

8/29 虽然通过用户现场纠偏捞回很多原则，但没把所有“动作级 Acceptance”一起捞回来。

这就是当前最值得修的上下文链。
