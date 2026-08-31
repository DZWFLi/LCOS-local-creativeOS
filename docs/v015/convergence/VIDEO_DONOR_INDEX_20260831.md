# LCOS v0.15 · Video Donor 原稿总索引与施工映射
## Lovart / Trae / TapNow / Lovart Composer / Codex Desktop

日期：2026-08-31  
状态：**MANDATORY GUI DONOR INDEX**

> 这些视频不是“灵感收藏”。
>
> 它们是当前 v0.15 Frontend Convergence 的交互 / 动效 / 层级 / Camera / Pin / Composer 参考证据。
>
> 涉及对应施工域时必须回读解析原稿，而不是只记 donor 名字。

---

# 1. 三条大视频

## V01 · Lovart

原视频：
`2026-08-30 23-42-28.mp4`

解析原稿：
`LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`

重点：

- Artifact content-first
- contextual toolbar outside object
- local popover
- loading footprint / skeleton
- object remains object
- local operation，不切工作模式
- controls do not cover content

主要施工映射：

- Generic CanvasCard retirement
- Object Orbit / contextual toolbar
- Overlay placement
- ResultSlot / loading
- Text / Image / Artifact morphology
- Phase B + Phase D

---

## V02 · Trae

原视频：
`2026-08-30 23-41-39.mp4`

解析原稿：
`LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`

重点：

- quiet rest state
- hover blast radius extremely small
- tooltip is explanation, not a UI mode
- menu grows from trigger
- progressive disclosure
- micro interaction scale

主要施工映射：

- Hover / tooltip
- Right-click / More
- Object Orbit satellites
- tiny contextual UI
- HUD motion token
- Phase A + Phase D

---

## V03 · TapNow

原视频：
`2026-08-30 23-45-41.mp4`

解析原稿：
`LCOS_v015_Lovart_Trae_TapNow_交互与动效拆解_20260830.md`

重点：

- object-local toolbar
- content = body / controls = satellites
- Geometry LOD + Content LOD
- Result slots appear before results
- provenance through spatial relation
- Pin / color point
- screen-space controls
- camera / spatial interaction feeling

主要施工映射：

- Universal Orbit
- Text Geometry LOD
- Pin HUD
- Dynamic Glyph
- Relation
- ResultSlot materialization
- Camera Focus
- Phase A / B / D

---

# 2. 后续详细视频

## V04 · Lovart Composer / Reference Pick

原视频：
`2026-08-31 00-01-00.mp4`

解析原稿：
`LCOS_v015_Lovart_Composer_ReferencePick_补充拆解_20260831.md`

重点：

```text
Selection ≠ Reference
```

状态链：

```text
Composer
→ explicit Add Reference
→ temporary Reference Pick Mode
→ click Canvas objects
→ reference strip updates
→ Esc exits Pick Mode
→ Composer remains
```

同时：

- Composer remains task anchor
- reference thumbnail = identity confirmation
- advanced parameters stay secondary
- no extra source-manager modal
- same-face prompt editing

主要施工映射：

- Unified Composer
- Ctrl/Cmd Reference
- Reference Pick Mode
- Selection semantics
- Glyth → Speak → Composer
- Phase A

硬 E2E：

```text
Selection count != Reference count
```

---

## V05 · Codex Desktop

原视频：
`2026-08-31 00-42-12.mp4`

解析原稿：
`LCOS_v015_CodexDesktop_局部锚点_PersistentPanel_交互拆解_20260831.md`

重点：

- central content stays stable
- local anchor → local hover preview
- skeleton fills same popup footprint
- local explanation ≠ persistent management
- right persistent environment panel only for long-lived work context
- progressive disclosure
- overlay has visible causal source

主要施工映射：

- Source / Provenance
- Node Info
- Context clue
- local anchor popover
- Inspector / side panel admission
- Overlay ownership
- Phase A / C / D

---

# 3. 施工阶段索引

## Phase A · Shared Spatial Kernel / Owner Cleanup

必须读：

- V02 Trae
- V03 TapNow
- V04 Lovart Composer
- V05 Codex Desktop

重点：

- Selection
- Reference
- Orbit
- Right-click
- popup source
- transient hierarchy
- one dominant interaction
- hit target

---

## Phase B · Object Species

必须读：

- V01 Lovart
- V03 TapNow

重点：

- content-first
- body remains body
- controls = satellites
- visual geometry LOD
- loading footprint
- no generic card shell

---

## Phase C · Context / Workflow / Assembly / Skill

必须读：

- V03 TapNow
- V05 Codex Desktop
- V01 Lovart

重点：

- component is content/morphology, not operation room
- local actions near object
- persistent panel only for persistent work
- Camera Focus / same-canvas operation
- path/relation as spatial truth

注意：

> Video donor 只提供 craft / interaction evidence。
> Component taxonomy / Skill / Assembly truth 仍以 LCOS 原始冻结稿为 authority。

---

## Phase D · Pin / Glyph / Material / Motion

必须读：

- V03 TapNow
- V01 Lovart
- V02 Trae
- V05 Codex Desktop

重点：

- Pin HUD
- color point
- screen-space size
- hover scale
- material clarity
- small blast radius
- causal motion
- skeleton → content
- local bubble

---

# 4. 当前问题 → donor 速查

| 当前 LCOS 问题 | 第一 donor |
|---|---|
| Text 远处巨大空框 | TapNow |
| Selection 后对象突然换状态 | Lovart + TapNow |
| Composer 太像配置页 | Lovart Composer |
| Selection 自动变 Reference | Lovart Composer |
| Popup 无来源地弹中间 | Trae + Codex Desktop |
| Overlay 盖住对象 | Lovart + TapNow |
| Pin / Marker 太小 | TapNow |
| Pin 颜色导航 | TapNow |
| Relation controls 缺空间因果 | TapNow |
| Loading / Result 突然出现 | Lovart + TapNow |
| Context info 大卡 | Codex Desktop |
| Source / provenance 常驻太重 | Codex Desktop |
| Right side panel 滥用 | Codex Desktop |
| Hover 动效太大/太多 | Trae |
| Object toolbar 缺层级 | TapNow + Lovart |
| HUD / Glyph 动态缩放 | TapNow |

---

# 5. Donor 使用红线

禁止：

- 拷贝 Lovart taxonomy
- 把 TapNow 做成 LCOS IA
- 抄 Trae chat product model
- 抄 Codex Desktop 的 repo/task taxonomy

允许：

```text
Copy behavior
Borrow craft
Preserve LCOS world
```

只借：

- interaction hierarchy
- motion grammar
- spatial causality
- scale
- progressive disclosure
- loading
- placement
- camera framing
- pin / glyph craft

---

# 6. 每次施工 Handoff 增加 Donor Conformance

如果触及 GUI interaction / motion：

```markdown
## Donor conformance

Relevant video donor:
- V0X ...

Parsed source:
- ...

Borrowed behavior:
- ...

LCOS semantic truth preserved:
- ...

What was explicitly NOT copied:
- ...
```

没有 donor 映射的纯视觉拍脑袋修改，不进入 final convergence。

---

# 7. 一句话

> 视频不是“看完就算吸收”，而是要像原始产品文档一样，成为可追溯的施工参考。

尤其 V03 TapNow 与 V04 Lovart Composer：
分别是当前 **Spatial Interaction / Pin** 和 **Composer / Reference** 的一级 GUI donor。
