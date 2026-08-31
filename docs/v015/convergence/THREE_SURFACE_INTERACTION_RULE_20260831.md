# LCOS v0.15 · 三 Surface 交互同构硬规则
## Main / Context / Workflow Shared Spatial Interaction Kernel

日期：2026-08-31

---

# 0. 最终裁决

Main / Context / Workflow：

不是三套交互系统。

它们必须共享同一套：

- Selection
- Multi-selection
- Orbit
- Reference
- Composer
- Relation
- Pin / Marker
- Right-click context menu
- Move / Resize
- Semantic Drop
- Focus / Camera Fit
- Search / Focus navigation
- Keyboard shortcuts
- Overlay placement
- Interaction LOD

三者的区别只应该存在于：

```text
Main
= 项目地形

Context
= 项目理解
+ Context Components / Lens editing

Workflow
= 项目行动
+ Workflow Components / Path editing
```

也就是说：

> Surface Difference = semantic objects + component capabilities

不是：

> Surface Difference = 基础鼠标和键盘操作重新实现一套

---

# 1. 基础交互矩阵

| 操作 | Main | Context | Workflow | 规则 |
|---|---|---|---|---|
| Click Selection | ✅ | ✅ | ✅ | 完全同构 |
| Shift + Click additive | ✅ | ✅ | ✅ | 完全同构 |
| Marquee / Lasso multi-select | ✅ | ✅ | ✅ | Main 有什么，另外两者就必须有 |
| Ctrl/Cmd + Click Reference | ✅ | ✅ | ✅ | Selection ≠ Reference |
| Object Orbit | ✅ | ✅ | ✅ | Universal Object Orbit |
| Right-click menu | ✅ | ✅ | ✅ | Pin / Focus / Open / Assembly 等通用动作 |
| Move | ✅ | ✅ | ✅ | species capability 决定是否允许 |
| Resize | ✅ | ✅ | ✅ | species-specific resize |
| Relation Draw | ✅ | ✅ | ✅ | Orbit → Relation → receptive edge |
| Pin / Unpin | ✅ | ✅ | ✅ | 任意可定位对象 |
| Composer / Speak | ✅ | ✅ | ✅ | 对 Glyth/可执行目标一致 |
| Reference Pick Mode | ✅ | ✅ | ✅ | Composer 保持原位 |
| Semantic Drop | ✅ | ✅ | ✅ | Drop 到哪 = 在这里使用 |
| Focus / Camera Fit | ✅ | ✅ | ✅ | 同一 camera framing engine |
| Search | ✅ | ✅ | ✅ | Project Search |
| Focus / 在哪 | ✅ | ✅ | ✅ | 已知对象定位 |
| Esc / outside close | ✅ | ✅ | ✅ | overlay stack 统一 |
| Interaction LOD | ✅ | ✅ | ✅ | 远处仍可点，不丢 hit target |

任何一格缺失：

> v0.15 P0 Regression

---

# 2. Context 只多什么

Context 只应该额外拥有：

- Structure Component
- Evolution Component
- Relationship Component
- Source / Provenance Component
- Context-specific lens
- component focus/edit
- Context-level Assembly target

Context 不应该额外发明：

- Context Selection
- Context Multi-select
- Context Orbit
- Context Composer
- Context Right-click
- Context Navigation

这些全部复用 shared kernel。

---

# 3. Workflow 只多什么

Workflow 只应该额外拥有：

- Scope Component
- Step / Action object
- Workflow Path
- Review / Checkpoint
- Skill Builder projection
- Workflow-specific Assembly
- component/path editing

Workflow 不应该重新发明：

- Workflow Selection
- Workflow Multi-select
- Workflow Orbit
- Workflow Composer
- Workflow Pin
- Workflow Right-click

---

# 4. Scope 的正式裁决

Scope 不应是：

```text
一个孤立 Scope Node
```

Scope 应该是：

> **Workflow Component / Field / Lens**

它表达：

- 这段 Workflow 当前作用到哪里
- 包含哪些对象
- 当前装配了什么
- 当前执行范围

它可以：

- hover 展开
- focus
- edit
- resize
- assembly

但不应该是一张 representation-only proxy card。

---

# 5. Active Path 的正式裁决

如果真实步骤 / action 已经通过 Relation / Path 连起来：

> 那条 Path 本身就是真实路径。

不能再生成一个：

```text
Active Path Node
```

去代表“这里存在一条活动路径”。

Active Path Component 只有在提供额外真实能力时才存在，例如：

- 筛选当前活跃路径
- 分析执行状态
- reorganize / compare
- camera focus

否则应退役。

---

# 6. “现场 / 结构 / 演进眼镜”的裁决

旧的独立 Surface Lens UI：

> 不再作为 Workflow / Context 的第二套 mode system。

可以复用的是真正有价值的能力：

- 目标定位
- Camera Fit
- Focus framing
- 从 overview 到 target 的 camera travel
- focus restore

因此保留底层：

```text
FocusLens / CameraFraming
```

但它应被：

- Pin
- Navigation
- Component Focus
- Search Focus
- Orbit Focus

调用。

而不是继续暴露成一个独立“眼镜系统”。

---

# 7. Universal Right-click

右键应该承担：

> 通用、低频、非当前 dominant action。

建议所有 Surface / Species 共用基础 menu：

```text
Open / Focus
Pin / Unpin
Add Reference
Assembly
Duplicate（若允许）
Reveal / Source
Delete / Remove Projection
More...
```

再按 species 加额外动作。

不要把这些全部塞到 Orbit。

---

# 8. Orbit 的职责

Orbit 只保留：

> 与当前对象最直接、最高频的 3–5 个动作。

例如普通 Artifact：

```text
Open
Relation
Pin
Assembly
More
```

Glyth：

```text
Speak
Relation
Pin
Set Current
Assembly / More
```

Context Component：

```text
Focus/Edit
Relation
Pin
Assembly
More
```

Workflow Component：

```text
Edit
Relation
Pin
Assembly
More
```

不要把：
- status
- runtime metadata
- provenance
- delete
- 低频管理动作

全部塞进 Orbit。

---

# 9. Shared Composer

Main / Context / Workflow 中 Composer 完全同构：

```text
Explicit Speak / Compose
→ Compact Composer

Ctrl/Cmd+Click
→ Quick Reference

Composer → Add Reference
→ Temporary Reference Pick Mode
```

普通 Selection：

> 永远不自动变 Reference。

---

# 10. Multi-selection 是 Shared Spatial Primitive

目前 Context / Workflow 多选失效属于 P0。

正确架构不能是：

```text
MainSelectionState
ContextSelectionState
WorkflowSelectionState
```

而应是同一 Interaction Kernel：

```text
SelectionController
  surfaceId
  selectedProjectionIds
  additive
  marquee/lasso
  focus
```

Surface 只提供：

> 当前有哪些可选 projection。

手势和 Selection 语义完全一致。

---

# 11. Hit Target / Interaction LOD

远缩放以后：

- visual 可以缩小
- detail 可以减少
- controls 可以隐藏

但：

> interaction bounds 不能缩没。

所有三个 Surface 都遵守：

```text
Visual Bounds
≠
Interaction Bounds
≠
Semantic LOD
```

最小 screen-space hit target 应保持可点。

---

# 12. Camera Focus

三个 Surface 共用：

```text
fitSpatialTarget()
```

模式：

- locate
- read
- edit
- overview

Component / Pin / Search / Focus / Navigation 都调用同一个 framing engine。

不要 Context 一套 camera、Workflow 一套 camera。

---

# 13. Production 架构目标

最终：

```text
SpatialInteractionKernel
├─ Selection
├─ MultiSelection
├─ Reference
├─ Orbit
├─ ContextMenu
├─ Relation
├─ Pin
├─ Composer
├─ SemanticDrop
├─ OverlayPlacement
├─ HitTesting
├─ CameraFocus
└─ InteractionLOD

        ↓

MainSurfaceAdapter
ContextSurfaceAdapter
WorkflowSurfaceAdapter
```

Surface Adapter 只回答：

```text
这里有哪些 projection？
这个对象有哪些 capability？
这个 Surface 有哪些专属 component？
```

不重新实现基础 interaction。

---

# 14. E2E 硬验收

对同一个 Artifact，分别投影到：

- Main
- Context
- Workflow

逐 Surface 运行完全相同测试：

```text
Click
Shift+Click
Marquee
Ctrl/Cmd+Click
Orbit
Right click
Pin
Relation
Move
Resize
Focus
Semantic Drop
```

预期：

> 交互行为完全一致。

然后额外测试：

Context：
- component focus/edit

Workflow：
- scope/path/component edit

只有这些是 Surface-specific。

---

# 15. 一句话

> Main / Context / Workflow 的区别是“你在理解项目、看项目还是推动项目”，不是“鼠标突然换了一套用法”。

如果主画布能做、Context/Workflow 做不了：

> 不是 Feature Gap，是 Shared Spatial Kernel 没真正收敛。
